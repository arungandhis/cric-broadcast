from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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
active_matches = {}
active_connections = {}

# ---------------------------------------------------------
# Run match: store JSON from frontend
# ---------------------------------------------------------
@app.post("/run-match/{match_id}")
async def run_match(match_id: str, match: dict):
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
    active_connections[match_id].append(websocket)

    try:
        info = match.get("info", {})
        await websocket.send_json({
            "type": "meta",
            "teams": info.get("teams", []),
            "event": info.get("event", {}),
            "toss": info.get("toss", {}),
        })

        innings = match.get("innings", [])
        for inning_index, inning in enumerate(innings, start=1):
            inning_name = list(inning.keys())[0]
            inning_data = inning[inning_name]
            deliveries = inning_data.get("deliveries", [])

            for delivery in deliveries:
                over_key = list(delivery.keys())[0]
                event = delivery[over_key]

                over_num, ball_num = map(int, over_key.split("."))

                await websocket.send_json({
                    "type": "ball",
                    "inning": inning_index,
                    "team": inning_name,
                    "over": over_num,
                    "ball": ball_num,
                    "event": event,
                })

                await asyncio.sleep(0.35)

        await websocket.send_json({"type": "end"})
        await websocket.close()

    except WebSocketDisconnect:
        pass
    finally:
        conns = active_connections.get(match_id, [])
        if websocket in conns:
            conns.remove(websocket)

# ---------------------------------------------------------
# Cricsheet loader (unchanged)
# ---------------------------------------------------------
CRICSHEET_BASE = "https://cricsheet.org/downloads/"

FORMATS = {
    "t20s": "t20s_male_json.zip",
    "odis": "odis_male_json.zip",
    "tests": "tests_male_json.zip",
}

zip_cache = {}

def get_zip(format_key: str):
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

def is_real_world_cup(event_name: str):
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

    matches.sort(key=lambda m: m["year"], reverse=True)
    return {"world_cup": matches}

@app.get("/cricsheet/{format}/{filename}")
def cricsheet_match(format: str, filename: str):
    if format not in FORMATS:
        raise HTTPException(404, "Invalid format")

    z = get_zip(format)

    try:
        with z.open(filename) as f:
            return f.read().decode("utf-8")
    except KeyError:
        raise HTTPException(404, "Match not found")
