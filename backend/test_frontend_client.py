import requests
import time
import json

# --- Configuration ---
# --- CORRECTED PORT ---
# This MUST match the port in main_app.py (e.g., 5007)
SERVER_URL = "http://localhost:6023/get_path"

# --- CORRECTED NODE ---
# This MUST be a valid node from your graph.json (e.g., "P2")
START_NODE = "P14" 

# --- Main Test Loop ---
print(f"--- Aegis AI Test Client ---")
print(f"Starting to poll server at: {SERVER_URL}")
print(f"Requesting path from '{START_NODE}' every 5 seconds...")
print("--------------------------------------------------")

current_time_sec = 0
while True:
    try:
        # 1. Build the request parameters
        # --- CORRECTED PARAMS ---
        # Your server auto-finds exits, so we only send the start_node
        params = {
            "start_node": START_NODE
        }
        
        # 2. Call your server's /get_path endpoint
        response = requests.get(SERVER_URL, params=params)
        
        print(f"\n[Time: {current_time_sec}s] Polling server...")
        
        # 3. Check the response
        if response.status_code == 200:
            # --- SUCCESS ---
            data = response.json()
            print("  ✅ SUCCESS (200 OK)")
            print(f"   Live Danger Nodes: {data.get('live_danger_nodes')}")
            print(f"   Calculated Cost:   {data.get('cost')}")
            print(f"   Safest Path:       {data.get('path')}")
            
            # This is the "Aha!" moment for your demo
            if data.get('live_danger_nodes'):
                print("\n  🔥🔥🔥 INCIDENT DETECTED! Path has been re-routed. 🔥🔥🔥")

        else:
            # --- FAILURE ---
            print(f"  ❌ FAILED (Status Code: {response.status_code})")
            print(f"     Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"\n[Time: {current_time_sec}s] ❌ FAILED")
        print("     Could not connect to server.")
        print(f"     Is 'main_app.py' running on port 5007?")
    
    except Exception as e:
        print(f"\n[Time: {current_time_sec}s] ❌ FAILED")
        print(f"     An unknown error occurred: {e}")

    # 4. Wait for the next 5-second interval
    time.sleep(5)
    current_time_sec += 5