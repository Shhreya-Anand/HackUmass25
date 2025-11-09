import google.generativeai as genai
import networkx as nx
import cv2  # OpenCV
import json
import os
import time
import threading # For the background scanner
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import asyncio
from elevenlabs.client import ElevenLabs
from elevenlabs.conversational_ai.conversation import Conversation
from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface

# Load environment variables from .env file
load_dotenv()

# --- 1. Global State & Configuration ---

CURRENT_WORLD_STATE = {
    "danger_nodes": [],
    "crowd_data": []
}
STATE_LOCK = threading.Lock()

# Voice agent state
VOICE_AGENT_STATE = {
    "location": None,
    "is_active": False,
    "session_id": None
}
VOICE_LOCK = threading.Lock()

# --- CORRECTED VIDEO_SOURCES ---
# These keys (P1, P2, etc.) MUST match your graph.json
VIDEO_SOURCES = {
    "P1": "videos/a.mp4", # This node will change over time (fire)
    "P2": "videos/b.mp4",
    "P4": "videos/c.mp4",
    "P5": "videos/e.mp4",
    "P14": "videos/d.mp4"
}
# Assuming b.mp4 is a "normal" video

# --- 2. Load Static Data (Graph & AI Model) ---

try:
    with open('graph.json', 'r') as f:
        NODE_LIST = json.load(f) # Load the LIST of nodes
    print("Loaded graph.json successfully.")
except Exception as e:
    print(f"FATAL ERROR: Could not load graph.json: {e}")
    NODE_LIST = []

# --- RECONCILED GRAPH BUILDING ---
G = nx.Graph()
node_lookup = {} # To quickly find node data by ID

# 1. Add all the nodes from the list
for node in NODE_LIST:
    G.add_node(node["id"], name=node["name"], x=node["x"], y=node["y"], exit_node=node["exit_node"])
    node_lookup[node["id"]] = node # Save for fast lookups

# 2. Add all the edges using the "adjacent" key
for node in NODE_LIST:
    u_id = node["id"]
    u_node_data = node_lookup[u_id]
    
    for v_id in node["adjacent"]:
        if v_id in node_lookup:
            v_node_data = node_lookup[v_id]
            dx = u_node_data["x"] - v_node_data["x"]
            dy = u_node_data["y"] - v_node_data["y"]
            weight = (dx**2 + dy**2)**0.5 # sqrt(dx^2 + dy^2)
            G.add_edge(u_id, v_id, weight=weight)
        else:
            print(f"Warning: Node {u_id} lists adjacent node {v_id} which does not exist.")

print(f"Built NetworkX graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")

# 3. Find all exit nodes at startup
EXIT_NODES_LIST = [node["id"] for node in NODE_LIST if node.get("exit_node", False)]
print(f"Found {len(EXIT_NODES_LIST)} exit nodes: {EXIT_NODES_LIST}")
# --- END RECONCILED GRAPH BUILDING ---


# Configure Gemini API
try:
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
except KeyError:
    print("FATAL ERROR: GOOGLE_API_KEY environment variable not set.")
    exit()

# Define the function (tool) Gemini will call
report_incident_tool = {
    "name": "report_incident_details",
    "description": "Report all nodes that are in danger AND nodes with large crowds.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "danger_nodes": {
                "type": "ARRAY",
                "description": "A list of all node IDs that are unsafe (fire/smoke).",
                "items": {"type": "STRING"}
            },
            "crowd_nodes": {
                "type": "ARRAY",
                "description": "A list of objects for nodes with crowds/people.",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "node_id": {"type": "STRING"},
                        "people_count": {"type": "NUMBER"}
                    }
                }
            }
        },
        "required": ["danger_nodes", "crowd_nodes"]
    }
}

# Select the VLM model (1.5 Flash is fast and cheap)
gemini_model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    tools=[report_incident_tool]
)
print("Gemini model configured.")

# --- 3. Helper Functions (File Upload & Frame Extraction) ---

def upload_file_to_gemini(path, mime_type=None):
    """Uploads a file and WAITS for it to be 'ACTIVE'."""
    print(f"Uploading {path}...")
    file = genai.upload_file(path=path, mime_type=mime_type)
    
    timeout_seconds = 120 # 2 minute timeout
    start_time = time.time()
    
    while time.time() - start_time < timeout_seconds:
        file = genai.get_file(file.name)
        if file.state.name == "ACTIVE":
            return file
        if file.state.name == "FAILED":
            raise ValueError(f"File {file.name} failed to process.")
        
        print(f"   ...state is {file.state.name}, waiting 2 seconds...")
        time.sleep(2) 
        
    raise TimeoutError(f"File {file.name} processing timed out.")

def extract_frame_as_image(video_path, frame_time_sec, output_path):
    """Extracts one frame from a video and saves it as a JPG."""
    vid_cap = None
    try:
        vid_cap = cv2.VideoCapture(video_path)
        fps = vid_cap.get(cv2.CAP_PROP_FPS)
        if fps == 0:
            fps = 30 
            print(f"Warning: Could not get FPS for {video_path}. Assuming {fps} FPS.")
        
        # Get video duration to cap frame_time_sec
        frame_count = vid_cap.get(cv2.CAP_PROP_FRAME_COUNT)
        video_duration_sec = frame_count / fps if fps > 0 else 0
        
        # Cap frame_time_sec to video duration, cycling if needed
        if video_duration_sec > 0:
            frame_time_sec = frame_time_sec % video_duration_sec
        else:
            # Fallback: cap at 30 seconds if we can't determine duration
            frame_time_sec = frame_time_sec % 30
            
        frame_id = int(fps * frame_time_sec)
        vid_cap.set(cv2.CAP_PROP_POS_FRAMES, frame_id)
        success, image = vid_cap.read()
        
        if success:
            cv2.imwrite(output_path, image)
            return True
        else:
            print(f"Error reading frame from {video_path} at {frame_time_sec}s")
            return False
    except Exception as e:
        print(f"Error with OpenCV: {e}")
        return False
    finally:
        if vid_cap:
            vid_cap.release()

# --- 4. The Background "Scanner" Thread ---

def scan_cctv_loop():
    """
    This is the "Scanner" thread. It runs forever in the background.
    """
    current_time_sec = 0
    print("\n*** Background Scanner Thread STARTED ***\n")
    
    #global_wind = {'speed': '15mph', 'direction': 'NW'}
    
    while True:
        print(f"\n--- SCANNER (Time: {current_time_sec}s): Starting new scan... ---")
        
        snapshot_jobs = [
            {"node_id": "P1", "source_video": VIDEO_SOURCES["P1"]},
            {"node_id": "P2", "source_video": VIDEO_SOURCES["P2"]},
            {"node_id": "P4", "source_video": VIDEO_SOURCES["P4"]},
            {"node_id": "P5", "source_video": VIDEO_SOURCES["P5"]},
            {"node_id": "P14", "source_video": VIDEO_SOURCES["P14"]},
        ]

        # 2. Extract a frame from each video
        temp_image_files = []
        for i, job in enumerate(snapshot_jobs):
            if job["node_id"] not in VIDEO_SOURCES:
                print(f"Warning: Node {job['node_id']} not in VIDEO_SOURCES dict. Skipping.")
                continue
            if not os.path.exists(job["source_video"]):
                print(f"Warning: Video file not found at {job['source_video']}. Skipping node {job['node_id']}.")
                continue
            
            # Use current_time_sec directly - extract_frame_as_image will handle capping to video duration
            frame_time = current_time_sec
            temp_path = f"./temp_frame_{i}.jpg"
            success = extract_frame_as_image(job["source_video"], frame_time, temp_path)
            if success:
                temp_image_files.append({"node_id": job["node_id"], "path": temp_path})

        # 3. Call Gemini (VLM) with all frames
        gemini_files_to_delete = []
        if not temp_image_files:
            print("--- SCANNER: No images extracted. Skipping Gemini call. ---")
            current_time_sec += 5
            time.sleep(5) 
            continue 

        try:
            # --- THIS IS THE CORRECTED PROMPT ---
            prompt_parts = [
                f"You are a *cautious* and *methodical* AI Incident Commander.",
                f"Your job is to analyze *snapshot images* from CCTV feeds one by one with a high degree of precision.",
                f"Here is the static map's layout (node list): {json.dumps(NODE_LIST)}", # <-- This is the fix
                # f"Here is the current wind data: {json.dumps(global_wind)}",
                "\n--- IMAGE FEEDS ---"
            ]
            
            for img_info in temp_image_files:
                gemini_file = upload_file_to_gemini(img_info["path"], mime_type="image/jpeg")
                gemini_files_to_delete.append(gemini_file)
                prompt_parts.append(f"\nThis *snapshot image* is from node: '{img_info['node_id']}'")
                prompt_parts.append(gemini_file) 

            prompt_parts.append(
                """
                Analyze this data with extreme caution.
                
                **CRITICAL INSTRUCTIONS:**
                1.  **Analyze EACH image feed INDIVIDUALLY.**
                2.  **DEMAND HIGH CONFIDENCE.** Only flag *unambiguous, clear evidence* of "fire" or "dense smoke".
                3.  **NEGATIVE PROMPTING:** Do NOT flag steam, dust, fog, sunsets, or red cars.
                
                **YOUR TASK:**
                1.  **First, (in your mind) review each image one-by-one:**
                    * Does the image for 'P1' show fire/smoke?
                    * ...and so on for all other nodes.
                2.  **Second,** identify which node(s) (if any) are the source of the fire.
                3.  **Third,** identify which node(s) (if any) show 'large crowds' (10+ people).
                
                4.  **Finally,** call the `report_incident_details` function with:
                    a) a list of nodes that are *currently* on fire OR in the *direct path* of the predicted danger zone.
                    b) a list of all nodes where you see large crowds.
                """
            )
            
            chat = gemini_model.start_chat(enable_automatic_function_calling=True)
            response = chat.send_message(prompt_parts)
            
            function_call = response.candidates[0].content.parts[0].function_call
            if function_call.name == "report_incident_details":
                args = function_call.args
                new_danger_nodes = list(args.get("danger_nodes", []))
                new_crowd_data = list(args.get("crowd_nodes", []))
                
                with STATE_LOCK:
                    CURRENT_WORLD_STATE["danger_nodes"] = new_danger_nodes
                    CURRENT_WORLD_STATE["crowd_data"] = new_crowd_data
                
                print(f"--- SCANNER: State Updated! ---")
                print(f"   Danger Nodes: {new_danger_nodes}")
                print(f"   Crowd Data: {new_crowd_data}")

        except Exception as e:
            # --- MAKE THIS LOUDER ---
            print("\n" + "="*50)
            print(f"--- SCANNER: FATAL ERROR IN GEMINI CALL ---")
            print(f"DETAILS: {e}")
            print("="*50 + "\n")
            # --- END OF LOUD ERROR ---
        finally:
            for file in gemini_files_to_delete:
                try:
                    genai.delete_file(file.name)
                except Exception as e:
                    print(f"Warning: Could not delete file {file.name}. Error: {e}")
            for img in temp_image_files:
                if os.path.exists(img["path"]):
                    os.remove(img["path"])
            
        current_time_sec += 5
        print(f"--- SCANNER: Loop finished. Waiting 5 seconds... ---")
        time.sleep(5) 

# --- 5. FastAPI App & Startup Event ---

app = FastAPI(title="Aegis AI - Main Server")

# --- LIFESPAN EVENT HANDLER (Replaces @app.on_event) ---
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # This code runs ON STARTUP
    print("Application startup...")
    # Start the background "Scanner" thread
    scanner_thread = threading.Thread(target=scan_cctv_loop, daemon=True)
    scanner_thread.start()
    yield
    # This code runs ON SHUTDOWN (we don't need anything here)
    print("Application shutdown.")

app = FastAPI(title="Aegis AI - Main Server", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=False,  # Cannot be True with allow_origins=["*"]
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)
# --- END OF LIFESPAN HANDLER ---


# --- 6. The API Endpoint for the Frontend ---

@app.get("/get_world_state")
def get_world_state():
    """
    Get the current world state including danger nodes and crowd data.
    This endpoint allows the frontend to poll for live fire detection updates.
    """
    with STATE_LOCK:
        danger_nodes = list(CURRENT_WORLD_STATE["danger_nodes"])
        crowd_data = list(CURRENT_WORLD_STATE["crowd_data"])
    
    return {
        "danger_nodes": danger_nodes,
        "crowd_data": crowd_data,
        "has_fire": len(danger_nodes) > 0
    }

@app.get("/get_path")
def get_safe_path(
    start_node: str = Query(..., description="The starting node ID for pathfinding"),
    affected_nodes: List[str] = Query(default=[], description="List of affected nodes from previous Gemini analysis")
):
    """
    Finds the safest, lowest-cost path from a start_node to the
    nearest *auto-detected* exit_node, using the *live* world state.
    If affected_nodes are provided, they are merged with the current world state.
    """
    
    with STATE_LOCK:
        danger_nodes = list(CURRENT_WORLD_STATE["danger_nodes"])
        crowd_data = list(CURRENT_WORLD_STATE["crowd_data"])
    
    # Merge affected_nodes from frontend with current world state
    # Use affected_nodes if provided, otherwise use world state
    if affected_nodes:
        # Combine affected_nodes with current danger_nodes (union, no duplicates)
        combined_danger_nodes = list(set(danger_nodes + affected_nodes))
        print(f"\n--- API CALL: /get_path ---")
        print(f"   Start: {start_node}")
        print(f"   Affected Nodes (from frontend): {affected_nodes}")
        print(f"   Current World State Danger Nodes: {danger_nodes}")
        print(f"   Combined Danger Nodes: {combined_danger_nodes}")
        print(f"   Live Crowd Data: {crowd_data}")
        danger_nodes = combined_danger_nodes
    else:
        print(f"\n--- API CALL: /get_path ---")
        print(f"   Start: {start_node}")
        print(f"   Live Danger Nodes: {danger_nodes}")
        print(f"   Live Crowd Data: {crowd_data}")

    G_copy = G.copy()
    
    for node in danger_nodes:
        if G_copy.has_node(node):
            G_copy.remove_node(node)
            print(f"   REMOVING: {node}")
        else:
            print(f"   Warning: Danger node {node} not in graph.")
            
    for crowd_info in crowd_data:
        node_id = crowd_info.get("node_id")
        penalty = crowd_info.get("people_count", 0)
        
        if G_copy.has_node(node_id):
            for neighbor in list(G_copy.neighbors(node_id)): 
                try:
                    edge = G_copy[node_id][neighbor]
                    edge['weight'] = edge.get('weight', 1) + penalty
                    print(f"   PENALTY: +{penalty} to edges near {node_id}")
                except KeyError:
                    print(f"   Skipping penalty for edge {node_id}-{neighbor} (neighbor removed).")
        else:
            print(f"   Warning: Crowd node {node_id} not in graph.")

    # --- A* Heuristic Function ---
    def astar_heuristic(u, v):
        try:
            node_u = G.nodes[u]
            node_v = G.nodes[v]
            dx = node_u['x'] - node_v['x']
            dy = node_u['y'] - node_v['y']
            return (dx**2 + dy**2)**0.5 # Euclidean distance
        except KeyError:
            return 0 

    shortest_path = None
    min_length = float('inf')
    
    if not G_copy.has_node(start_node):
        raise HTTPException(status_code=404, detail=f"Start node '{start_node}' is blocked or invalid.")

    # Use the globally defined EXIT_NODES_LIST
    for exit_node in EXIT_NODES_LIST: 
        if not G_copy.has_node(exit_node):
            print(f"   Skipping exit {exit_node}, as it's blocked or invalid.")
            continue 
        
        try:
            path = nx.astar_path(G_copy, start_node, exit_node, 
                                 heuristic=astar_heuristic, weight='weight')
            length = nx.astar_path_length(G_copy, start_node, exit_node, 
                                        heuristic=astar_heuristic, weight='weight')
            
            if length < min_length:
                min_length = length
                shortest_path = path
                
        except nx.NetworkXNoPath:
            print(f"   No path from {start_node} to {exit_node}.")
            continue
            
    if shortest_path:
        print(f"   PATH FOUND: {shortest_path} (Cost: {min_length})")
        return {"path": shortest_path, "cost": min_length, "live_danger_nodes": danger_nodes}
    else:
        print(f"   NO PATH FOUND from {start_node} to any valid exit.")
        raise HTTPException(status_code=404, detail="No safe path found.")


# --- 7.5. Eleven Labs Alert Audio Generation ---

class AlertAudioRequest(BaseModel):
    danger_nodes: List[str]
    escape_path: List[str]
    start_node: Optional[str] = None

@app.post("/generate_alert_audio")
async def generate_alert_audio(request: AlertAudioRequest):
    """
    Generate audio alert using Eleven Labs agent with danger nodes and escape path information.
    Returns audio stream that can be played on frontend.
    """
    try:
        # Extract data from request
        danger_nodes = request.danger_nodes
        escape_path = request.escape_path
        start_node = request.start_node
        
        # Get Eleven Labs client
        client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        agent_id = os.getenv("ELEVENLABS_AGENT_ID", "agent_4701k9k3jegye7armnes8xvznfsb")
        
        # Format the alert message
        danger_nodes_str = ", ".join(danger_nodes) if danger_nodes else "none detected"
        path_str = " -> ".join(escape_path) if escape_path else "no path available"
        
        # Create a natural language alert message
        alert_message = f"""
        Emergency Alert: Fire detected in the following areas: {danger_nodes_str}.
        Please evacuate immediately using the following route: {path_str}.
        Stay calm and follow the evacuation path. Do not use elevators.
        """
        
        # Get node names for better readability
        node_names = {}
        for node in NODE_LIST:
            node_names[node["id"]] = node.get("name", node["id"])
        
        # Format with node names if available
        danger_names = [node_names.get(node, node) for node in danger_nodes]
        path_names = [node_names.get(node, node) for node in escape_path]
        
        if danger_names:
            danger_str = ", ".join(danger_names)
        else:
            danger_str = "no areas"
            
        if path_names:
            path_str_formatted = " to ".join(path_names)
        else:
            path_str_formatted = "no evacuation route available"
        
        print(f"\n--- TRIGGERING FIRE ALERT AGENT ---")
        print(f"   Danger Nodes: {danger_nodes}")
        print(f"   Escape Path: {escape_path}")
        
        # Get agent ID
        agent_id = os.getenv("ELEVENLABS_AGENT_ID", "agent_4701k9k3jegye7armnes8xvznfsb")
        
        # Create and run the fire alert agent
        # The agent will automatically yell "FIRE!" and ask where you are
        agent = FireAlertAgent()
        
        # Start the agent in a background task
        # This will trigger the agent to speak automatically
        task = asyncio.create_task(agent.run_fire_alert(agent_id))
        
        # Return immediately - agent is running in background
        return {
            "status": "started",
            "message": "Fire alert agent activated. Agent is speaking now."
        }
        
    except Exception as e:
        print(f"   Error triggering fire alert agent: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to trigger fire alert agent: {str(e)}")


# --- 8. Voice Agent Integration ---
class FireAlertAgent:
    def __init__(self):
        self.client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        self.conversation = None
        self.location_detected = None
        
    async def on_message(self, message):
        """Callback when agent receives a message"""
        print(f"\n[Message] Role: {message.role}")
        print(f"[Message] Content: {message.content}")
        
        # If user provided location, store it
        if message.role == "user" and message.content:
            self.location_detected = message.content
            print(f"\n✓ Location captured: {self.location_detected}")
    
    async def on_status_change(self, status):
        """Callback when connection status changes"""
        print(f"[Status] {status}")
    
    async def on_mode_change(self, mode):
        """Callback when conversation mode changes"""
        print(f"[Mode] {mode.mode}")
    
    async def on_error(self, error):
        """Callback when error occurs"""
        print(f"[Error] {error}")
    
    async def run_fire_alert(self, agent_id):
        """Main conversation flow with ElevenLabs Conversational AI"""
        print("\n=== FIRE ALERT SYSTEM ACTIVATED ===\n")
        print("🔥 FIRE DETECTED! Agent is yelling 'FIRE!' and asking for your location.\n")
        
        # Initialize conversation with callbacks
        self.conversation = Conversation(
            client=self.client,
            agent_id=agent_id,
            requires_auth=False,  # Set to True if agent requires authentication
            audio_interface=DefaultAudioInterface(),
            callback_agent_response=self.on_message,
            callback_user_transcript=self.on_message,
            callback_latency_measurement=None,
        )
        
        # Add event listeners
        self.conversation.on_status_change = self.on_status_change
        self.conversation.on_mode_change = self.on_mode_change
        self.conversation.on_error = self.on_error
        
        print("Starting conversation with fire alert agent...")
        print("The agent will yell 'FIRE!' and ask for your location. Please speak clearly.\n")
        
        # Start the conversation
        # The agent will automatically speak when the session starts
        await self.conversation.start_session()
        
        # Wait for conversation to complete or timeout
        try:
            # Keep conversation alive for 60 seconds or until user stops
            # This gives time for the agent to speak and user to respond
            await asyncio.sleep(60)
        except KeyboardInterrupt:
            print("\nStopping conversation...")
        finally:
            await self.conversation.end_session()
            print("\n=== FIRE ALERT SESSION ENDED ===\n")
        
        return self.location_detected


@app.post("/trigger_fire_agent")
async def trigger_fire_agent():
    """
    Trigger the fire alert agent when fire is detected.
    The agent will automatically yell 'FIRE!' and ask where you are.
    """
    try:
        # Get agent ID
        agent_id = os.getenv("ELEVENLABS_AGENT_ID", "agent_4701k9k3jegye7armnes8xvznfsb")
        
        print("\n=== TRIGGERING FIRE ALERT AGENT ===")
        print("🔥 FIRE DETECTED! Starting agent...\n")
        
        # Create and run the fire alert agent
        # The agent will automatically yell "FIRE!" and ask where you are
        agent = FireAlertAgent()
        
        # Start the agent in a background task
        # This will trigger the agent to speak automatically through system audio
        task = asyncio.create_task(agent.run_fire_alert(agent_id))
        
        # Return immediately - agent is running in background
        return {
            "status": "started",
            "message": "Fire alert agent activated. Agent is yelling 'FIRE!' and asking for your location."
        }
        
    except Exception as e:
        print(f"   Error triggering fire alert agent: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to trigger fire alert agent: {str(e)}")

# --- 7. Run the Server ---

if __name__ == "__main__":
    print("Starting FastAPI server and background scanner...")
    # --- PORT FIX ---
    # Running on a new, clean port
    uvicorn.run(app, host="0.0.0.0", port=8080)
