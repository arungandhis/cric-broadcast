from fastapi import FastAPI, HTTPException
import requests
import zipfile
import io
import json

app = FastAPI()

CRICSHEET_BASE = "https://cricsheet.org/downloads/"

FORMATS = {
    "t20s": "t20s_male_json.zip",
    "odis": "odis_male_json.zip",
    "tests": "tests_male_json.zip",
}

# Cache ZIPs in memory (RAM)
zip_cache = {}

WORLD_CUP_KEYWORDS = [
    "World Cup",
    "ICC Cricket World Cup",
    "ICC Men's Cricket World Cup",
    "Prudential World Cup",
    "Reliance World Cup",
    "Benson & Hedges World Cup",
    "Wills World Cup"
]

def is_world_cup_event(name: str):
    return any(keyword in name for keyword in WORLD_CUP_KEYWORDS)


def get_zip(format_key: str):
    """Fetch ZIP from Cricsheet.org and keep in memory."""
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


@app.get("/cricsheet/index.json")
def world_cup_index():
    """Return ONLY ICC Men's Cricket World Cup matches (1975 → 2023)."""
    z = get_zip("odis")  # World Cup matches are all ODIs

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

            # Skip non-World Cup matches
            if not is_world_cup_event(event_name):
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

    return { "world_cup": matches }


@app.get("/cricsheet/{format}/{filename}")
def cricsheet_match(format: str, filename: str):
    """Return the actual match JSON directly from Cricsheet ZIP."""
    if format not in FORMATS:
        raise HTTPException(404, "Invalid format")

    z = get_zip(format)

    try:
        with z.open(filename) as f:
            return f.read().decode("utf-8")
    except KeyError:
        raise HTTPException(404, "Match not found")
