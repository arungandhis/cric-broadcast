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
