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
