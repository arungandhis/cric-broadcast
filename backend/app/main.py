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
# 2. WebSocket Connection Manager (per match_id)
# ---------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        # match_id -> list[WebSocket]
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, match_id: str):
        print(f"WS: Client connected for match {match_id}")
        await websocket.accept()
        self.active.setdefault(match_id, []).append(websocket)
        print("WS: Active connections for", match_id, "=", len(self.active[match_id]))

    def disconnect(self, websocket: WebSocket, match_id: str):
        print(f"WS: Client disconnected for match {match_id}")
        conns = self.active.get(match_id, [])
        if websocket in conns:
            conns.remove(websocket)
        print("WS: Active connections for", match_id, "=", len(conns))

    async def broadcast(self, match_id: str, message: str):
        conns = list(self.active.get(match_id, []))
        print(f"WS: Broadcasting to {len(conns)} clients for match {match_id}")
        for connection in conns:
            try:
                await connection.send_text(message)
            except Exception as e:
                print("WS: Error sending message:", e)
                self.disconnect(connection, match_id)


manager = ConnectionManager()


@app.websocket("/ws/match/{match_id}")
async def websocket_match(websocket: WebSocket, match_id: str):
    await manager.connect(websocket, match_id)
    try:
        while True:
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)
    except Exception as e:
        print("WS: Unexpected error:", e)
        manager.disconnect(websocket, match_id)


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
# 4. Broadcast events from a saved JSON file (per match_id)
# ---------------------------------------------------------
async def broadcast_events(file_path: Path, match_id: str):
    print("BROADCAST: Starting broadcast_events() with file:", file_path, "match_id:", match_id)

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

    # Give frontend time to connect WebSocket
    await asyncio.sleep(1)

    for idx, event in enumerate(events, start=1):
        message = {
            "type": "ball",
            "ball_number": idx,
            "event": event,
        }

        print("BROADCAST: Sending event", idx, "for match", match_id)
        await manager.broadcast(match_id, json.dumps(message))
        await asyncio.sleep(BALL_DELAY)

    print("BROADCAST: Finished sending all events for match", match_id)


# ---------------------------------------------------------
# 5. /run-match/{match_id} — Accept Cricsheet JSON from frontend
# ---------------------------------------------------------
@app.post("/run-match/{match_id}")
async def run_match(match_id: str, request: Request, background_tasks: BackgroundTasks):
    print(f"API: /run-match called for match_id={match_id} — receiving match JSON")

    try:
        data = await request.json()
    except Exception as e:
        print("API: ERROR parsing JSON body:", e)
        return {"status": "error", "detail": "Invalid JSON"}

    temp_file = DATA_DIR / f"current_match_{match_id}.json"
    try:
        with open(temp_file, "w") as f:
            json.dump(data, f)
        print("API: Match JSON saved to", temp_file)
    except Exception as e:
        print("API: ERROR saving match file:", e)
        return {"status": "error", "detail": "Failed to save match"}

    background_tasks.add_task(broadcast_events, temp_file, match_id)
    print("API: Background task started for match", match_id)
    return {"status": "Match started", "match_id": match_id}
