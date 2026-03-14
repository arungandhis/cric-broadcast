from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio, json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

clients = set()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.websocket("/ws/match")
async def match_ws(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            await asyncio.sleep(60)
    finally:
        clients.remove(ws)

class EventSink:
    @staticmethod
    def broadcast(event: dict):
        data = json.dumps(event)
        for ws in list(clients):
            asyncio.create_task(ws.send_text(data))
