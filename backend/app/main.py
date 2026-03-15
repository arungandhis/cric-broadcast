from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import asyncio
import json

app = FastAPI()

# Allow your frontend to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cric-broadcast-frontend.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Correct path for Render
# -----------------------------
BASE_DIR = Path(__file__).parent.parent
MATCH_FILE = BASE_DIR / "data" / "sample_match.json"

BALL_DELAY = 1.5  # seconds between balls


# -----------------------------
# Connection manager for WebSocket
# -----------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        print("WS: Client connected")
        await websocket.accept()
        self.active_connections.append(websocket)
        print("WS: Active connections =", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        print("WS: Client disconnected")
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print("WS: Active connections =", len(self.active_connections))

    async def broadcast(self, message: str):
        print("WS: Broadcasting to", len(self.active_connections), "clients")
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                print("WS: Error sending message:", e)
                self.disconnect(connection)


manager = ConnectionManager()


# -----------------------------
# WebSocket endpoint
# -----------------------------
@app.websocket("/ws/match")
async def websocket_match(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print("WS: Unexpected error:", e)
        manager.disconnect(websocket)


# -----------------------------
# Match loading and broadcasting
# -----------------------------
def load_match_events():
    print("LOAD: Loading match file:", MATCH_FILE)

    try:
        with open(MATCH_FILE, "r") as f:
            data = json.load(f)
    except Exception as e:
        print("LOAD: ERROR reading JSON:", e)
        return []

    print("LOAD: JSON loaded successfully")

    events = []
    for inning in data.get("innings", []):
        for over in inning.get("overs", []):
            for delivery in over.get("deliveries", []):
                events.append(delivery)

    print("LOAD: Total events parsed =", len(events))
    return events


async def broadcast_events():
    print("BROADCAST: Starting broadcast_events()")

    events = load_match_events()
    print("BROADCAST: Events =", events)

    if not events:
        print("BROADCAST: No events found — nothing to send")
        return

    for idx, event in enumerate(events, start=1):
        message = {
            "type": "ball",
            "ball_number": idx,
            "event": event,
        }

        print("BROADCAST: Sending event", idx, message)

        await manager.broadcast(json.dumps(message))
        await asyncio.sleep(BALL_DELAY)

    print("BROADCAST: Finished sending all events")


# -----------------------------
# HTTP endpoint to start match
# -----------------------------
@app.post("/run-match")
async def run_match(background_tasks: BackgroundTasks):
    print("API: /run-match called — starting background task")
    background_tasks.add_task(broadcast_events)
    return {"status": "Match started"}
