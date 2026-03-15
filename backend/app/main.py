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

MATCH_FILE = Path("data/sample_match.json")
BALL_DELAY = 1.5  # seconds between balls


# -----------------------------
# Connection manager for WebSocket
# -----------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        # Send to all connected clients
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                # Drop broken connections
                self.disconnect(connection)


manager = ConnectionManager()


# -----------------------------
# WebSocket endpoint
# -----------------------------
@app.websocket("/ws/match")
async def websocket_match(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # We don't really need to receive anything from client now,
        # just keep the connection open.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# -----------------------------
# Match loading and broadcasting
# -----------------------------
def load_match_events():
    with open(MATCH_FILE, "r") as f:
        data = json.load(f)

    events = []
    for inning in data.get("innings", []):
        for over in inning.get("overs", []):
            for delivery in over.get("deliveries", []):
                events.append(delivery)
    return events


async def broadcast_events():
    events = load_match_events()
    for idx, event in enumerate(events, start=1):
        message = {
            "type": "ball",
            "ball_number": idx,
            "event": event,
        }
        await manager.broadcast(json.dumps(message))
        await asyncio.sleep(BALL_DELAY)


# -----------------------------
# HTTP endpoint to start match
# -----------------------------
@app.post("/run-match")
async def run_match(background_tasks: BackgroundTasks):
    background_tasks.add_task(broadcast_events)
    return {"status": "Match started"}
