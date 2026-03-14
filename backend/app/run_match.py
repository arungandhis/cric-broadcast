import asyncio
import json
import websockets
from pathlib import Path

# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------

# Your deployed backend WebSocket URL
WS_URL = "wss://cric-broadcast-backed.onrender.com/ws/match"

# Path to a Cricsheet JSON match file
MATCH_FILE = Path("data/sample_match.json")

# Delay between balls (seconds)
BALL_DELAY = 1.5


# ---------------------------------------------------------
# LOAD MATCH DATA
# ---------------------------------------------------------

def load_match_events():
    if not MATCH_FILE.exists():
        raise FileNotFoundError(f"Match file not found: {MATCH_FILE}")

    with open(MATCH_FILE, "r") as f:
        data = json.load(f)

    # Cricsheet format: data["innings"][0]["overs"][0]["deliveries"]
    events = []

    for inning in data.get("innings", []):
        for over in inning.get("overs", []):
            for delivery in over.get("deliveries", []):
                # Each delivery is a dict with ball info
                events.append(delivery)

    return events


# ---------------------------------------------------------
# SEND EVENTS TO WEBSOCKET
# ---------------------------------------------------------

async def broadcast_events():
    print(f"Connecting to WebSocket: {WS_URL}")

    try:
        async with websockets.connect(WS_URL) as ws:
            print("Connected! Starting event stream...")

            events = load_match_events()

            for idx, event in enumerate(events, start=1):
                message = {
                    "type": "ball",
                    "ball_number": idx,
                    "event": event
                }

                await ws.send(json.dumps(message))
                print(f"Sent ball {idx}: {event}")

                await asyncio.sleep(BALL_DELAY)

            print("All events sent. Closing connection.")

    except Exception as e:
        print(f"Error: {e}")


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

if __name__ == "__main__":
    asyncio.run(broadcast_events())
