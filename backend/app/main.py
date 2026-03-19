from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import zipfile
import io
import json

app = FastAPI()

# ---------------------------------------------------------
# CORS — REQUIRED for frontend to access backend
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Cricsheet ZIP configuration
# ---------------------------------------------------------
CRICSHEET_BASE = "https://cricsheet.org/downloads/"

FORMATS = {
    "t20s": "t20s_male_json.zip",
    "odis": "odis_male_json.zip",
    "tests": "tests_male_json.zip",
}

zip_cache = {}

# ---------------------------------------------------------
# Helper: Load ZIP into memory
# ---------------------------------------------------------
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

# ---------------------------------------------------------
# Helper: Strict World Cup filter
# ---------------------------------------------------------
def is_real_world_cup(event_name: str):
    """
    Include ONLY real ICC Men's Cricket World Cup matches.
    Exclude qualifiers, leagues, playoffs, challenge leagues, etc.
    """
    if "World Cup" not in event_name:
        return False

    EXCLUDE = [
        "Qualifier",
        "League",
        "Playoff",
        "Challenge",
        "Super League",
        "League 2"
    ]

    return not any(bad in event_name for bad in EXCLUDE)

# ---------------------------------------------------------
# Endpoint: World Cup index
# ---------------------------------------------------------
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

            # Filter only real World Cup matches
            if not is_real_world_cup(event_name):
                continue

            teams = info.get("teams", [])
            dates = info.get("dates", [])
            year = int(str(dates[0])[0:4]) if dates else None

            matches.append({
                "file": f"odis/{name}",
                "year": year,
                "teams": teams
            })

        except Exception:
            continue

    # Sort newest → oldest
    matches.sort(key=lambda m: m["year"], reverse=True)

    return {"world_cup": matches}

# ---------------------------------------------------------
# Endpoint: Fetch match JSON
# ---------------------------------------------------------
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
