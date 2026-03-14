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
