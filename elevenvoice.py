# from elevenlabs.client import ElevenLabs
# from elevenlabs import play

# client = ElevenLabs(
#     api_key="sk_5be85c57dd8b93e794fd2d1cda011af65464dddea3e97a8d"
# )

# audio = client.text_to_speech.convert(
#     text="The first move is what sets everything in motion.",
#     voice_id="JBFqnCBsd6RMkjVDRZzb",
#     model_id="eleven_multilingual_v2",
#     output_format="mp3_44100_128",
# )

# play(audio)


from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.conversational_ai.conversation import Conversation
from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface
import os
import asyncio

load_dotenv()

class FireAlertAgent:
    def __init__(self):
        self.client = ElevenLabs(api_key=os.getenv("sk_4ad9511a354442c0991c3d3081f679fdd4051df3a91d6c71"))
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
        print("The agent will ask for your location. Please speak clearly.\n")
        
        # Start the conversation
        await self.conversation.start_session()
        
        # Wait for conversation to complete or timeout
        try:
            # Keep conversation alive for 30 seconds or until user stops
            await asyncio.sleep(30)
        except KeyboardInterrupt:
            print("\nStopping conversation...")
        finally:
            await self.conversation.end_session()
        
        return self.location_detected


# Alternative: Using REST API directly for signed URLs
class FireAlertAgentWithAuth:
    def __init__(self):
        self.client = ElevenLabs(api_key=os.getenv("sk_4ad9511a354442c0991c3d3081f679fdd4051df3a91d6c71"))
        
    def get_signed_url(self, agent_id):
        """Get signed URL for authenticated agent"""
        # This is for agents that require authentication
        response = self.client.conversational_ai.get_signed_url(agent_id=agent_id)
        return response.signed_url
    
    async def run_with_signed_url(self, agent_id):
        """Run conversation with signed URL"""
        signed_url = self.get_signed_url(agent_id)
        
        conversation = Conversation(
            client=self.client,
            signed_url=signed_url,
            audio_interface=DefaultAudioInterface(),
        )
        
        await conversation.start_session()
        await asyncio.sleep(30)
        await conversation.end_session()


# Main execution
async def main():
    # Replace with your actual Agent ID from https://elevenlabs.io/app/agents
    AGENT_ID = "agent_4701k9k3jegye7armnes8xvznfsb"
    
    agent = FireAlertAgent()
    
    try:
        location = await agent.run_fire_alert(AGENT_ID)
        print(f"\n=== Alert Complete ===")
        print(f"Location recorded: {location}")
    except KeyboardInterrupt:
        print("\nAlert system interrupted")
    except Exception as e:
        print(f"Error running alert system: {e}")


if __name__ == "__main__":
    # Installation required:
    # pip install python-dotenv elevenlabs
    
    
    
    asyncio.run(main())