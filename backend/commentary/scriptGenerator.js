// backend/commentary/scriptGenerator.js

/**
 * INPUT SHAPE (per over)
 * {
 *   over_number: 1,
 *   balls: [
 *     {
 *       ball: 1,
 *       batter: "BB McCullum",
 *       bowler: "Z Khan",
 *       runs: { batter: 0, extras: 0, total: 0 },
 *       extras: { wides: 0, no_balls: 0, byes: 0, legbyes: 0 },
 *       wicket: { kind, player_out, fielders: [...] } | null
 *     },
 *     ...
 *   ],
 *   score_before: { runs: 5, wickets: 0 },
 *   score_after: { runs: 21, wickets: 0 },
 *   run_rate: 10.5,
 *   partnership: 32,
 *   batting_team: "Kolkata Knight Riders",
 *   bowling_team: "Royal Challengers Bangalore"
 * }
 *
 * CONTEXT (optional)
 * {
 *   match: { venue, event_name, match_number, ... },
 *   innings_number: 1,
 *   target: null | { runs, overs }
 * }
 */

const COMMENTATORS_ROTATION = [
  { from: 1, to: 5, pair: ["Harsha", "Gavaskar"] },
  { from: 6, to: 10, pair: ["Ravi", "Ponting"] },
  { from: 11, to: 15, pair: ["Harsha", "Ravi"] },
  { from: 16, to: 20, pair: ["Ponting", "Harsha"] },
];

function getCommentatorsForOver(overNumber) {
  const slot =
    COMMENTATORS_ROTATION.find(
      (r) => overNumber >= r.from && overNumber <= r.to
    ) || COMMENTATORS_ROTATION[0];
  return slot.pair;
}

function detectBallEvent(ball) {
  const runs = ball.runs?.batter || 0;
  const total = ball.runs?.total || 0;
  const extras = ball.extras || {};
  const wicket = ball.wicket || null;

  if (wicket) return "wicket";
  if (extras.wides) return "wide";
  if (extras.no_balls) return "noball";
  if (runs === 6) return "six";
  if (runs === 4) return "four";
  if (total === 0) return "dot";
  return "runs";
}

function buildBallCall(ball, eventType) {
  const { ball: ballNum, batter, bowler } = ball;
  const total = ball.runs?.total || 0;
  const runs = ball.runs?.batter || 0;
  const wicket = ball.wicket || null;

  switch (eventType) {
    case "wicket":
      return `Ball ${ballNum}: ${bowler} to ${batter} — OUT! ${wicket.player_out} ${wicket.kind}!`;
    case "wide":
      return `Ball ${ballNum}: ${bowler} sprays it wide, and the umpire stretches his arms. Extra run to the batting side.`;
    case "noball":
      return `Ball ${ballNum}: No-ball from ${bowler}! Free hit coming up, and the pressure is on the bowler now.`;
    case "six":
      return `Ball ${ballNum}: ${bowler} to ${batter} — that's launched high and handsome for SIX!`;
    case "four":
      return `Ball ${ballNum}: ${bowler} to ${batter} — cracked away to the boundary for FOUR!`;
    case "dot":
      return `Ball ${ballNum}: ${bowler} to ${batter} — defended, no run.`;
    case "runs":
    default:
      return `Ball ${ballNum}: ${bowler} to ${batter} — they pick up ${total} run(s).`;
  }
}

function buildOverIntro(overData, commentators) {
  const [c1] = commentators;
  const { over_number, batting_team, bowling_team, score_before } = overData;

  const text = `${c1 === "Harsha"
    ? "Welcome back to the action."
    : "Right then, here we go again."
  } Over number ${over_number} coming up. ${batting_team} are ${score_before.runs}/${score_before.wickets}, and ${bowling_team} will be desperate to pull things back in this over.`;

  return {
    commentator: c1,
    duration: 18,
    cue: "over_intro",
    text,
  };
}

function buildBallSegments(overData, commentators) {
  const [c1, c2] = commentators;
  const segments = [];
  let toggle = 0;

  for (const ball of overData.balls) {
    const eventType = detectBallEvent(ball);
    const commentator = toggle === 0 ? c2 : c1;
    toggle = 1 - toggle;

    const text = buildBallCall(ball, eventType);

    segments.push({
      commentator,
      duration: 10 + (eventType === "six" || eventType === "wicket" ? 6 : 0),
      cue: `ball_${ball.ball}`,
      event: eventType,
      text,
    });
  }

  return segments;
}

function buildOverSummary(overData, commentators) {
  const [c1, c2] = commentators;
  const { over_number, score_before, score_after, run_rate, partnership } =
    overData;

  const runsThisOver = score_after.runs - score_before.runs;
  const wktsThisOver = score_after.wickets - score_before.wickets;

  const summary1 = `${c1 === "Harsha"
    ? "So at the end of the over,"
    : "End of the over now,"
  } ${overData.batting_team} move to ${score_after.runs}/${score_after.wickets}. That over went for ${runsThisOver} run(s)${wktsThisOver ? ` and ${wktsThisOver} wicket(s)` : ""}.`;

  const summary2 = `The run rate is now ${run_rate.toFixed(
    2
  )}, and this partnership has grown to ${partnership} runs. The pressure is ${run_rate >= 8 ? "firmly on the bowlers" : "nicely balanced at the moment"}.`;

  return [
    {
      commentator: c1,
      duration: 14,
      cue: "over_summary_1",
      text: summary1,
    },
    {
      commentator: c2,
      duration: 14,
      cue: "over_summary_2",
      text: summary2,
    },
  ];
}

function generateOverScript(overData, context = {}) {
  const commentators = getCommentatorsForOver(overData.over_number);

  const segments = [];

  // Intro
  segments.push(buildOverIntro(overData, commentators));

  // Ball-by-ball
  segments.push(...buildBallSegments(overData, commentators));

  // Over summary
  segments.push(...buildOverSummary(overData, commentators));

  const totalDuration = segments.reduce((acc, s) => acc + s.duration, 0);

  return {
    over: overData.over_number,
    duration_seconds: totalDuration,
    commentators,
    segments,
    context,
  };
}

module.exports = {
  generateOverScript,
};
