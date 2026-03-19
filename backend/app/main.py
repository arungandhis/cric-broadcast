from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import requests
import zipfile
import io
import json

app = FastAPI()

# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# In‑memory match storage
# ---------------------------------------------------------
active_matches: dict[str, dict] = {}
active_connections: dict[str, list[WebSocket]] = {}

# ---------------------------------------------------------
# Run match: store JSON from frontend
# ---------------------------------------------------------
@app.post("/run-match/{match_id}")
async def run_match(match_id: str, match: dict = Body(...)):
    """
    Accept the entire Cricsheet JSON body as the match object.
    Store it in memory keyed by match_id.
    """
    if not isinstance(match, dict):
        raise HTTPException(status_code=400, detail="Match payload must be a JSON object")

    innings = match.get("innings", [])
    if not innings:
        raise HTTPException(status_code=400, detail="Match JSON has no innings")

    active_matches[match_id] = match
    active_connections[match_id] = []
    return {"status": "ready", "match_id": match_id}

# ---------------------------------------------------------
# WebSocket: stream ball‑by‑ball events
# ---------------------------------------------------------
@app.websocket("/ws/match/{match_id}")
async def ws_match(websocket: WebSocket, match_id: str):
    await websocket.accept()

    if match_id not in active_matches:
        await websocket.send_json({"type": "error", "message": "Match not found"})
        await websocket.close()
        return

    match = active_matches[match_id]
    active_connections.setdefault(match_id, []).append(websocket)

    try:
        # ---- Send meta block first ----
        info = match.get("info", {})
        await websocket.send_json({
            "type": "meta",
            "teams": info.get("teams", []),
            "event": info.get("event", {}),
            "toss": info.get("toss", {}),
        })

        # ---- Cricsheet innings structure ----
        innings = match.get("innings", [])

        for inning_index, inning in enumerate(innings, start=1):
            # inning is like { "1st innings": { ... } }
            inning_name = list(inning.keys())[0]
            inning_data = inning[inning_name]

            team_name = inning_data.get("team")
            overs = inning_data.get("overs", [])

            for over in overs:
                # over looks like: { "over": 12, "deliveries": [ { "12.1": {...} }, ... ] }
                deliveries = over.get("deliveries", [])

                for delivery in deliveries:
                    # delivery is like { "12.1": { ...event... } }
                    ball_key = list(delivery.keys())[0]
                    event = delivery[ball_key]

                    # ball_key "12.1" → over_num=12, ball_num=1
                    try:
                        over_num, ball_num = map(int, ball_key.split("."))
                    except Exception:
                        over_num, ball_num = None, None

                    await websocket.send_json({
                        "type": "ball",
                        "inning": inning_index,
                        "inning_name": inning_name,
                        "team": team_name,
                        "over": over_num,
                        "ball": ball_num,
                        "ball_key": ball_key,
                        "event": event,
                    })

                    # control playback speed
                    await asyncio.sleep(0.35)

        await websocket.send_json({"type": "end"})
        await websocket.close()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        # send error to this client only
        try:
            await websocket.send_json({"type": "error", "message": f"Server error: {str(e)}"})
        except Exception:
            pass
        await websocket.close()
    finally:
        conns = active_connections.get(match_id, [])
        if websocket in conns:
            conns.remove(websocket)

# ---------------------------------------------------------
# Cricsheet loader
# ---------------------------------------------------------
CRICSHEET_BASE = "https://cricsheet.org/downloads/"

FORMATS = {
    "t20s": "t20s_male_json.zip",
    "odis": "odis_male_json.zip",
    "tests": "tests_male_json.zip",
}

zip_cache: dict[str, zipfile.ZipFile] = {}

def get_zip(format_key: str) -> zipfile.ZipFile:
    if format_key in zip_cache:
        return zip_cache[format_key]

    zip_name = FORMATS.get(format_key)
    if not zip_name:
        raise HTTPException(404, "Invalid format")

    url = CRICSHEET_BASE + zip_name
    r = requests.get(url)

    if r.status_code != 200:
        raise HTTPException(500, f"Failed to download {zip_name}")

    zip_cache[format_key] = zipfile.ZipFile(io.BytesIO(r.content))
    return zip_cache[format_key]

def is_real_world_cup(event_name: str) -> bool:
    if "World Cup" not in event_name:
        return False

    EXCLUDE = ["Qualifier", "League", "Playoff", "Challenge", "Super League", "League 2"]
    return not any(bad in event_name for bad in EXCLUDE)

@app.get("/cricsheet/index.json")
def world_cup_index():
    z = get_zip("odis")
    matches = []

    for name in z.namelist():
        if not name.endswith(".json"):
            continue

        try:
            with z.open(name) as f:
                data = json.load(f)

            info = data.get("info", {})
            event = info.get("event", {})
            event_name = event.get("name", "")

            if not is_real_world_cup(event_name):
                continue

            teams = info.get("teams", [])
            dates = info.get("dates", [])
            year = int(str(dates[0])[0:4]) if dates else None

            matches.append({
                "file": f"odis/{name}",
                "year": year,
                "teams": teams,
            })
        except Exception:
            continue

    matches.sort(key=lambda m: m["year"] or 0, reverse=True)
    return {"world_cup": matches}

@app.get("/cricsheet/{format}/{filename}")
def cricsheet_match(format: str, filename: str):
    if format not in FORMATS:
        raise HTTPException(404, "Invalid format")

    z = get_zip(format)

    try:
        with z.open(filename) as f:
            # return parsed JSON so frontend gets an object, not a string
            return json.load(f)
    except KeyError:
        raise HTTPException(404, "Match not found")
