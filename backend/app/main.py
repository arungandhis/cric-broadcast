from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
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
active_matches = {}          # match_id -> raw cricsheet match JSON
active_connections = {}      # match_id -> [WebSocket, ...]
current_match_id = None      # used by /ws scoreboard


# ---------------------------------------------------------
# Helper: build scoreboard state from Cricsheet match JSON
# ---------------------------------------------------------
def build_scoreboard_from_match(match: dict) -> dict:
    info = match.get("info", {})
    teams = info.get("teams", [])
    venue = info.get("venue", "")
    event = info.get("event", {})
    event_name = event.get("name", "")

    innings_out = []
    events_out = []

    for inn_index, inn in enumerate(match.get("innings", []), start=1):
        team = inn.get("team", f"Innings {inn_index}")
        overs = inn.get("overs", [])

        runs = 0
        wickets = 0
        balls = 0

        batting_stats = {}   # name -> {runs, balls, fours, sixes, out}
        bowling_stats = {}   # name -> {runs, balls, wickets, maidens}
        extras = {"b": 0, "lb": 0, "w": 0, "nb": 0, "p": 0}
        fow = []             # [{score, wicket, batter, over}, ...]

        overs_summary = []   # [{over_number, runs, wickets, balls: [{result}]}]

        # track per-over runs/wickets for Manhattan/overs
        for over in overs:
            over_no = over.get("over")
            deliveries = over.get("deliveries", [])

            over_runs = 0
            over_wkts = 0
            over_balls_list = []

            for ball_index, d in enumerate(deliveries, start=1):
                r_total = d.get("runs", {}).get("total", 0)
                r_batter = d.get("runs", {}).get("batter", 0)

                runs += r_total
                balls += 1
                over_runs += r_total

                batter = d.get("batter")
                bowler = d.get("bowler")

                # Batting stats
                if batter:
                    bs = batting_stats.setdefault(
                        batter,
                        {"runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out": False},
                    )
                    bs["runs"] += r_batter
                    bs["balls"] += 1
                    if r_batter == 4:
                        bs["fours"] += 1
                    if r_batter == 6:
                        bs["sixes"] += 1

                # Bowling stats
                if bowler:
                    bw = bowling_stats.setdefault(
                        bowler,
                        {"runs": 0, "balls": 0, "wickets": 0, "maidens": 0},
                    )
                    bw["runs"] += r_total
                    bw["balls"] += 1

                # Extras
                ex = d.get("extras", {})
                if "legbyes" in ex:
                    extras["lb"] += ex["legbyes"]
                if "wides" in ex:
                    extras["w"] += ex["wides"]
                if "noballs" in ex:
                    extras["nb"] += ex["noballs"]
                if "byes" in ex:
                    extras["b"] += ex["byes"]
                # penalty not present in this file, but keep key
                # extras["p"] stays 0

                # Wickets
                if "wickets" in d:
                    wickets += len(d["wickets"])
                    over_wkts += len(d["wickets"])
                    for w in d["wickets"]:
                        player_out = w.get("player_out")
                        if player_out and player_out in batting_stats:
                            batting_stats[player_out]["out"] = True
                        fow.append(
                            {
                                "score": runs,
                                "wicket": wickets,
                                "batter": player_out,
                                "over": f"{over_no}.{ball_index}",
                            }
                        )
                        if bowler:
                            bowling_stats[bowler]["wickets"] += 1

                # Simple event text
                events_out.append(
                    {
                        "over": over_no,
                        "ball": ball_index,
                        "text": f"{batter} {r_total} run(s)",
                    }
                )

                # For overs timeline
                result_label = "W" if "wickets" in d else str(r_total)
                over_balls_list.append({"result": result_label})

            overs_summary.append(
                {
                    "over_number": over_no,
                    "runs": over_runs,
                    "wickets": over_wkts,
                    "balls": over_balls_list,
                }
            )

        extras["total"] = extras["b"] + extras["lb"] + extras["w"] + extras["nb"] + extras["p"]

        innings_out.append(
            {
                "team": team,
                "runs": runs,
                "wickets": wickets,
                "balls": balls,
                "extras": extras,
                "batting": [
                    {
                        "name": name,
                        "runs": s["runs"],
                        "balls": s["balls"],
                        "fours": s["fours"],
                        "sixes": s["sixes"],
                        "status": "out" if s["out"] else "not out",
                    }
                    for name, s in batting_stats.items()
                ],
                "bowling": [
                    {
                        "name": name,
                        "runs": s["runs"],
                        "balls": s["balls"],
                        "wickets": s["wickets"],
                        "maidens": s["maidens"],
                    }
                    for name, s in bowling_stats.items()
                ],
                "overs": overs_summary,
                "fall_of_wickets": fow,
            }
        )

    match_title = ""
    if len(teams) == 2:
        match_title = f"{teams[0]} vs {teams[1]}"
    else:
        match_title = event_name or "Live Cricket Match"

    return {
        "match_title": match_title,
        "venue": venue,
        "is_live": True,
        "status_text": "Match in progress",
        "innings": innings_out,
        "events": events_out,
    }


# ---------------------------------------------------------
# Run match: store JSON from frontend
# ---------------------------------------------------------
@app.post("/run-match/{match_id}")
async def run_match(match_id: str, match: dict = Body(...)):
    global current_match_id

    if not isinstance(match, dict):
        raise HTTPException(400, "Match payload must be a JSON object")

    if "innings" not in match:
        raise HTTPException(400, "Match JSON missing innings")

    active_matches[match_id] = match
    active_connections[match_id] = []
    current_match_id = match_id  # <-- this is what /ws will use

    return {"status": "ready", "match_id": match_id}


# ---------------------------------------------------------
# WebSocket: stream ball‑by‑ball events (animation/debug)
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
        # Send meta first
        info = match.get("info", {})
        await websocket.send_json(
            {
                "type": "meta",
                "teams": info.get("teams", []),
                "event": info.get("event", {}),
                "toss": info.get("toss", {}),
            }
        )

        innings = match.get("innings", [])

        # CORRECT CRICSHEET STRUCTURE:
        # innings[] → { "team": "...", "overs": [ { "over": 0, "deliveries": [ {...}, {...} ] } ] }
        for inning_index, inning in enumerate(innings, start=1):
            team_name = inning.get("team", f"Innings {inning_index}")
            overs = inning.get("overs", [])

            for over in overs:
                over_number = over.get("over")
                deliveries = over.get("deliveries", [])

                for ball_index, delivery in enumerate(deliveries, start=1):
                    await websocket.send_json(
                        {
                            "type": "ball",
                            "inning": inning_index,
                            "team": team_name,
                            "over": over_number,
                            "ball": ball_index,
                            "event": delivery,
                        }
                    )

                    await asyncio.sleep(0.35)

        # Match complete
        await websocket.send_json({"type": "end"})
        await websocket.close()

    except WebSocketDisconnect:
        pass

    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
        await websocket.close()

    finally:
        conns = active_connections.get(match_id, [])
        if websocket in conns:
            conns.remove(websocket)


# ---------------------------------------------------------
# Global scoreboard WebSocket: used by frontend Scoreboard.jsx
# ---------------------------------------------------------
@app.websocket("/ws")
async def ws_scoreboard(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            if current_match_id is None or current_match_id not in active_matches:
                await websocket.send_json(
                    {
                        "match_title": "Live Cricket Match",
                        "is_live": False,
                        "status_text": "Waiting for match…",
                        "innings": [],
                        "events": [],
                    }
                )
            else:
                match = active_matches[current_match_id]
                scoreboard = build_scoreboard_from_match(match)
                await websocket.send_json(scoreboard)

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass

    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
        await websocket.close()


# ---------------------------------------------------------
# Cricsheet loader
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

            matches.append(
                {
                    "file": name,  # FIXED: return only filename
                    "year": year,
                    "teams": teams,
                }
            )
        except:
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
            return json.load(f)
    except KeyError:
        raise HTTPException(404, "Match not found")
