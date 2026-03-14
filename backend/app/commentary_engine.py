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
