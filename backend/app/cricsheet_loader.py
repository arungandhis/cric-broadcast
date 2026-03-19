import json
import os

# Path to extracted ODIS folder from odis.zip
CRICSHEET_DIR = "cricsheet/odis"

# All historical World Cup event names (1975 → 2023)
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
    """Return True if the event name matches any World Cup keyword."""
    return any(keyword in name for keyword in WORLD_CUP_KEYWORDS)


def load_world_cup_index():
    """Scan ODIS folder and return ONLY ICC Men's Cricket World Cup matches."""
    matches = []

    for root, _, files in os.walk(CRICSHEET_DIR):
        for f in files:
            if not f.endswith(".json"):
                continue

            path = os.path.join(root, f)

            try:
                with open(path, "r") as fp:
                    data = json.load(fp)

                info = data.get("info", {})
                event = info.get("event", {})
                name = event.get("name", "")

                # Skip non-World Cup matches
                if not is_world_cup_event(name):
                    continue

                teams = info.get("teams", [])
                dates = info.get("dates", [])
                year = int(str(dates[0])[0:4]) if dates else None

                # Convert to relative path for frontend
                rel_path = os.path.relpath(path, "cricsheet")

                matches.append({
                    "file": rel_path,
                    "year": year,
                    "teams": teams
                })

            except Exception:
                continue

    # Sort newest → oldest
    matches.sort(key=lambda m: m["year"], reverse=True)

    return { "world_cup": matches }
