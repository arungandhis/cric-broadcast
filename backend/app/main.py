from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
import asyncio
import json
import httpx

app = FastAPI()

# Allow frontend
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

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

BALL_DELAY = 1.5  # seconds between balls

CRICSHEET_BASE = "https://cricsheet.org/downloads"


# ---------------------------------------------------------
# 1. PROXY ENDPOINT — Load Cricsheet ZIPs (Fixes CORS)
# ---------------------------------------------------------
@app.get("/cricsheet/{zip_name}")
async def proxy_cricsheet(zip_name: str):
    url = f"{CRICSHEET_BASE}/{zip_name}"
    print("Proxying Cricsheet ZIP:", url)

    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        r.raise_for_status()

    return StreamingResponse(
        iter([r.content]),
        media_type="application/zip",
    )


# ---------------------------------------------------------
# 2. WebSocket Connection Manager
# ---------------------------------------------------------
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


# ---------------------------------------------------------
# 3. Parse Cricsheet JSON into ball events
# ---------------------------------------------------------
def load_match_events_from_data(data: dict):
    print("LOAD: Parsing match JSON")
    events = []
    for inning in data.get("innings", []):
        for over in inning.get("overs", []):
            for delivery in over.get("deliveries", []):
                events.append(delivery)
    print("LOAD: Total events parsed =", len(events))
    return events


# ---------------------------------------------------------
# 4. Broadcast events from a saved JSON file
# ---------------------------------------------------------
async def broadcast_events(file_path: Path):
    print("BROADCAST: Starting broadcast_events() with file:", file_path)

    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        print("BROADCAST: ERROR reading match file:", e)
        return

    events = load_match_events_from_data(data)

    if not events:
        print("BROADCAST: No events found — nothing to send")
        return

    for idx, event in enumerate(events, start=1):
        message = {
            "type": "ball",
            "ball_number": idx,
            "event": event,
        }

        print("BROADCAST: Sending event", idx)
        await manager.broadcast(json.dumps(message))
        await asyncio.sleep(BALL_DELAY)

    print("BROADCAST: Finished sending all events")


# ---------------------------------------------------------
# 5. /run-match — Accept Cricsheet JSON from frontend
# ---------------------------------------------------------
@app.post("/run-match")
async def run_match(request: Request, background_tasks: BackgroundTasks):
    print("API: /run-match called — receiving match JSON")

    try:
        data = await request.json()
    except Exception as e:
        print("API: ERROR parsing JSON body:", e)
        return {"status": "error", "detail": "Invalid JSON"}

    temp_file = DATA_DIR / "current_match.json"
    try:
        with open(temp_file, "w") as f:
            json.dump(data, f)
        print("API: Match JSON saved to", temp_file)
    except Exception as e:
        print("API: ERROR saving match file:", e)
        return {"status": "error", "detail": "Failed to save match"}

    # ---------------------------------------------------------
    # IMPORTANT FIX: Delay broadcast so WebSocket can connect
    # ---------------------------------------------------------
    async def delayed_start():
        await asyncio.sleep(1)  # give frontend time to connect
        await broadcast_events(temp_file)

    background_tasks.add_task(delayed_start)
    print("API: Background task started")

    return {"status": "Match started"}
