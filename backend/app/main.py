from fastapi import FastAPI, BackgroundTasks
import asyncio
import json
import websockets
from pathlib import Path

app = FastAPI()

WS_URL = "wss://cric-broadcast-backed.onrender.com/ws/match"
MATCH_FILE = Path("data/sample_match.json")
BALL_DELAY = 1.5


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
    async with websockets.connect(WS_URL) as ws:
        events = load_match_events()
        for idx, event in enumerate(events, start=1):
            message = {
                "type": "ball",
                "ball_number": idx,
                "event": event
            }
            await ws.send(json.dumps(message))
            await asyncio.sleep(BALL_DELAY)


@app.post("/run-match")
async def run_match(background_tasks: BackgroundTasks):
    background_tasks.add_task(broadcast_events)
    return {"status": "Match started"}
