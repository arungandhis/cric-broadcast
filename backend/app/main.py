from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
import asyncio
import json
import httpx

app = FastAPI()

# -------------------------------------------------
# CORS
# -------------------------------------------------
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

BALL_DELAY = 1.5
CRICSHEET_BASE = "https://cricsheet.org/downloads"


# -------------------------------------------------
# 1. Cricsheet proxy
# -------------------------------------------------
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


# -------------------------------------------------
# 1B. NEW — Serve cricsheet index.json
# -------------------------------------------------
@app.get("/cricsheet/index.json")
async def get_cricsheet_index():
    index_file = DATA_DIR / "index.json"

    if not index_file.exists():
        print("ERROR: index.json not found in backend/data/")
        return {"error": "index.json not found"}

    try:
        with open(index_file, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        print("ERROR reading index.json:", e)
        return {"error": "failed to read index.json"}


# -------------------------------------------------
# 2. WebSocket manager
# -------------------------------------------------
class ConnectionManager:
    def __init__(self):
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


# -------------------------------------------------
# 3. Parse match into inning-aware events
# -------------------------------------------------
def load_match_events_from_data(data: dict):
    print("LOAD: Parsing match JSON")
    events = []

    innings_list = data.get("innings", [])
    for inning_index, inning in enumerate(innings_list, start=1):
        team_name = inning.get("team", f"Team {inning_index}")

        for over in inning.get("overs", []):
            deliveries = over.get("deliveries", [])
            for idx, delivery in enumerate(deliveries):

                # New format: { "12.3": { ... } }
                if isinstance(delivery, dict) and len(delivery.keys()) == 1:
                    ball_key = list(delivery.keys())[0]

                    if "." in ball_key:
                        over_str, ball_str = ball_key.split(".", 1)
                        try:
                            over_num = int(over_str)
                            ball_num = int(ball_str)
                        except ValueError:
                            print(f"LOAD: Bad ball key: {ball_key}")
                            continue

                        events.append(
                            {
                                "inning": inning_index,
                                "team": team_name,
                                "over": over_num,
                                "ball": ball_num,
                                "delivery": delivery[ball_key],
                            }
                        )
                        continue

                # Old format
                over_num = over.get("over", 0)
                ball_num = idx + 1

                events.append(
                    {
                        "inning": inning_index,
                        "team": team_name,
                        "over": over_num,
                        "ball": ball_num,
                        "delivery": delivery,
                    }
                )

    print("LOAD: Total events parsed =", len(events))
    return events


# -------------------------------------------------
# 4. Broadcast events (with metadata first)
# -------------------------------------------------
async def broadcast_events(file_path: Path, match_id: str):
    print("BROADCAST: Starting broadcast_events() with file:", file_path, "match_id:", match_id)

    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        print("BROADCAST: ERROR reading match file:", e)
        return

    # -------------------------------------------------
    # SEND METADATA FIRST
    # -------------------------------------------------
    try:
        info = data.get("info", {})
        teams = info.get("teams", ["Team A", "Team B"])
        toss = info.get("toss", {})

        meta = {
            "type": "meta",
            "teamA": teams[0],
            "teamB": teams[1],
            "tossWinner": toss.get("winner", ""),
            "tossDecision": toss.get("decision", ""),
        }

        print("BROADCAST: Sending metadata:", meta)
        await manager.broadcast(match_id, json.dumps(meta))
        await asyncio.sleep(0.2)

    except Exception as e:
        print("BROADCAST: Failed to send metadata:", e)

    # -------------------------------------------------
    # SEND BALL EVENTS
    # -------------------------------------------------
    events = load_match_events_from_data(data)

    if not events:
        print("BROADCAST: No events found — nothing to send")
        return

    await asyncio.sleep(1)

    for idx, ev in enumerate(events, start=1):
        message = {
            "type": "ball",
            "ball_number": idx,
            "inning": ev["inning"],
            "team": ev["team"],
            "over": ev["over"],
            "ball": ev["ball"],
            "event": ev["delivery"],
        }

        print(
            f"BROADCAST: Sending event {idx} "
            f"(inning {ev['inning']} {ev['team']} over {ev['over']} ball {ev['ball']}) "
            f"for match {match_id}"
        )

        await manager.broadcast(match_id, json.dumps(message))
        await asyncio.sleep(BALL_DELAY)

    print("BROADCAST: Finished sending all events for match", match_id)


# -------------------------------------------------
# 5. /run-match/{match_id}
# -------------------------------------------------
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


# -------------------------------------------------
# 6. DEBUG ENDPOINT TO CONFIRM DEPLOYMENT
# -------------------------------------------------
@app.get("/main-version")
def main_version():
    return {"version": "metadata-v4"}
