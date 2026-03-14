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
