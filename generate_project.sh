 #!/bin/bash
set -e

echo "📁 Creating folder structure..."

mkdir -p backend/app
mkdir -p backend/data
mkdir -p frontend/src/three/models
mkdir -p frontend/src/ui
mkdir -p .devcontainer

echo "📄 Creating backend files..."

cat > backend/requirements.txt << 'EOF'
fastapi
uvicorn[standard]
EOF

cat > backend/app/event_server.py << 'EOF'
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
EOF

cat > backend/app/cricsheet_loader.py << 'EOF'
import json
from dataclasses import dataclass
from pathlib import Path

@dataclass
class BallEvent:
    match_id: str
    innings: int
    over: int
    ball: int
    batsman: str
    bowler: str
    runs_batsman: int
    runs_extras: int
    dismissal: dict | None
    extras: dict

def load_match(path: Path, match_id: str):
    raw = json.loads(path.read_text())
    balls = []

    for innings_idx, innings in enumerate(raw["innings"], start=1):
        inn = list(innings.values())[0]
        for delivery in inn["deliveries"]:
            ((over_ball, info),) = delivery.items()
            over, ball = map(int, over_ball.split("."))

            balls.append(
                BallEvent(
                    match_id=match_id,
                    innings=innings_idx,
                    over=over,
                    ball=ball,
                    batsman=info["batsman"],
                    bowler=info["bowler"],
                    runs_batsman=info["runs"]["batsman"],
                    runs_extras=info["runs"]["extras"],
                    dismissal=info.get("wicket"),
                    extras={k: v for k, v in info.items() if k in ["wide", "noball", "byes", "legbyes"]},
                )
            )
    return balls
EOF

cat > backend/app/match_engine.py << 'EOF'
class MatchState:
    def __init__(self):
        self.runs = 0
        self.wickets = 0
        self.balls = 0

    def apply_ball(self, ball):
        self.runs += ball.runs_batsman + ball.runs_extras
        if ball.dismissal:
            self.wickets += 1
        self.balls += 1

    @property
    def overs(self):
        return self.balls // 6 + (self.balls % 6) / 10
EOF

cat > backend/app/commentary_engine.py << 'EOF'
class CommentaryEngine:
    def generate(self, event, state):
        runs = event["runs_total"]
        batsman = event["batsman"]
        bowler = event["bowler"]

        if event["dismissal"]:
            return f"{batsman} is OUT! {event['dismissal']['kind']} off {bowler}."

        if runs == 0:
            return f"{bowler} bowls a dot ball to {batsman}."
        if runs == 4:
            return f"{batsman} drives beautifully for FOUR!"
        if runs == 6:
            return f"{batsman} launches it for a massive SIX!"

        return f"{batsman} takes {runs} run{'s' if runs > 1 else ''}."
EOF

cat > backend/app/context_builder.py << 'EOF'
class ContextBuilder:
    def enrich(self, ball, state, profiles):
        return {
            "match_id": ball.match_id,
            "innings": ball.innings,
            "over": ball.over,
            "ball": ball.ball,
            "batsman": ball.batsman,
            "bowler": ball.bowler,
            "runs_total": ball.runs_batsman + ball.runs_extras,
            "dismissal": ball.dismissal,
            "score": {
                "runs": state.runs,
                "wickets": state.wickets,
                "overs": state.overs,
            },
            "batsman_hand": profiles.get(ball.batsman, {}).get("batting_hand", "right"),
            "bowler_style": profiles.get(ball.bowler, {}).get("bowling_style", "right_arm_fast"),
            "shot_type": "generic",
        }
EOF

cat > backend/app/run_match.py << 'EOF'
import asyncio, json
from pathlib import Path
from cricsheet_loader import load_match
from match_engine import MatchState
from commentary_engine import CommentaryEngine
from context_builder import ContextBuilder
from event_server import EventSink

async def main():
    balls = load_match(Path("data/sample_match.json"), "sample")
    profiles = json.loads(Path("app/player_profiles.json").read_text())
    commentary = CommentaryEngine()
    context = ContextBuilder()
    state = MatchState()

    for ball in balls:
        state.apply_ball(ball)
        event = context.enrich(ball, state, profiles)
        event["commentary"] = commentary.generate(event, state)
        EventSink.broadcast(event)
        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(main())
EOF

cat > backend/app/player_profiles.json << 'EOF'
{
  "V Kohli": {
    "batting_hand": "right",
    "batting_style": "aggressive",
    "jersey_number": 18,
    "team": "India"
  },
  "M Starc": {
    "bowling_style": "left_arm_fast",
    "jersey_number": 56,
    "team": "Australia"
  }
}
EOF

echo "📄 Creating frontend files..."

cat > frontend/package.json << 'EOF'
{
  "name": "cric-broadcast-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@react-three/fiber": "^8.13.0",
    "three": "^0.160.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
EOF

cat > frontend/src/main.jsx << 'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
EOF

cat > frontend/src/App.jsx << 'EOF'
import { SceneRoot } from "./three/SceneRoot";

export default function App() {
  return <SceneRoot />;
}
EOF

cat > frontend/src/three/useMatchEvents.js << 'EOF'
import { useEffect } from "react";

export function useMatchEvents(onBall) {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/match");

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      onBall(event);
    };

    return () => ws.close();
  }, [onBall]);
}
EOF

cat > frontend/src/three/SceneRoot.jsx << 'EOF'
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { useMatchEvents } from "./useMatchEvents";
import { ScoreBug } from "../ui/ScoreBug";
import { CommentaryBar } from "../ui/CommentaryBar";

export function SceneRoot() {
  const [event, setEvent] = useState(null);

  useMatchEvents((e) => setEvent(e));

  return (
    <>
      <Canvas camera={{ position: [0, 10, 25], fov: 45 }}>
        <mesh position={[0, -1, 0]}>
          <boxGeometry args={[20, 0.5, 20]} />
          <meshStandardMaterial color="green" />
        </mesh>
      </Canvas>

      {event && (
        <>
          <ScoreBug score={event.score} />
          <CommentaryBar text={event.commentary} />
        </>
      )}
    </>
  );
}
EOF

cat > frontend/src/ui/ScoreBug.jsx << 'EOF'
export function ScoreBug({ score }) {
  return (
    <div style={{
      position: "absolute",
      top: 20,
      left: 20,
      padding: "10px 20px",
      background: "rgba(0,0,0,0.6)",
      color: "white",
      borderRadius: 8,
      fontSize: 20
    }}>
      {score.runs}/{score.wickets} ({score.overs})
    </div>
  );
}
EOF

cat > frontend/src/ui/CommentaryBar.jsx << 'EOF'
export function CommentaryBar({ text }) {
  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      left: 0,
      right: 0,
      padding: 20,
      background: "rgba(0,0,0,0.7)",
      color: "white",
      textAlign: "center",
      fontSize: 18
    }}>
      {text}
    </div>
  );
}
EOF

echo "🧰 Creating devcontainer..."

cat > .devcontainer/devcontainer.json << 'EOF'
{
  "name": "Cric Broadcast",
  "build": {
    "dockerfile": "Dockerfile"
  }
}
EOF

cat > .devcontainer/Dockerfile << 'EOF'
FROM mcr.microsoft.com/devcontainers/python:3.11

RUN apt-get update && apt-get install -y nodejs npm
EOF

echo "📝 Creating README..."

cat > README.md << 'EOF'
# Cric Broadcast Engine

A full 3D cricket broadcast engine using FastAPI + React + Three.js.
EOF

echo "🎉 Project generation complete!"
