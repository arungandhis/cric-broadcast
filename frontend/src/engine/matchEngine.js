// frontend/src/engine/matchEngine.js

export function createEmptyInnings(teamName = "") {
  return {
    team: teamName,
    runs: 0,
    wickets: 0,
    balls: 0,
    oversDisplay: "0.0",
    runRate: 0,
    extras: {
      wides: 0,
      noballs: 0,
      legbyes: 0,
      byes: 0,
      penalty: 0,
    },
    batters: {}, // name -> { runs, balls, fours, sixes, out }
    bowlers: {}, // name -> { oversBalls, runs, wickets, wides, noballs }
    currentBatters: [],
    currentBowler: null,
  };
}

function formatOvers(balls) {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${overs}.${rem}`;
}

function calcRunRate(runs, balls) {
  if (balls === 0) return 0;
  return +(runs * 6 / balls).toFixed(2);
}

export function applyBallToState(state, wsEvent) {
  if (wsEvent.type !== "ball") return state;

  const { inning, team, over, ball, event: delivery } = wsEvent;

  const inningsKey = `innings${inning}`;
  const prevInnings = state[inningsKey] || createEmptyInnings(team);
  const innings = structuredClone(prevInnings);

  const batterName = delivery.batter;
  const bowlerName = delivery.bowler;

  if (!innings.batters[batterName]) {
    innings.batters[batterName] = {
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: null,
    };
  }

  if (!innings.bowlers[bowlerName]) {
    innings.bowlers[bowlerName] = {
      oversBalls: 0,
      runs: 0,
      wickets: 0,
      wides: 0,
      noballs: 0,
    };
  }

  const batter = innings.batters[batterName];
  const bowler = innings.bowlers[bowlerName];

  const runsObj = delivery.runs || {};
  const batterRuns = runsObj.batter || 0;
  const extrasTotal = runsObj.extras || 0;
  const totalRuns = runsObj.total || batterRuns + extrasTotal;

  const extras = delivery.extras || {};
  if (extras.wides) innings.extras.wides += extras.wides;
  if (extras.noballs) innings.extras.noballs += extras.noballs;
  if (extras.legbyes) innings.extras.legbyes += extras.legbyes;
  if (extras.byes) innings.extras.byes += extras.byes;
  if (extras.penalty) innings.extras.penalty += extras.penalty;

  const isLegal =
    !extras.wides && !extras.noballs;

  if (isLegal) {
    innings.balls += 1;
    bowler.oversBalls += 1;
  }

  innings.runs += totalRuns;
  bowler.runs += totalRuns;

  if (batterRuns > 0 || isLegal) {
    batter.balls += isLegal ? 1 : 0;
    batter.runs += batterRuns;
    if (batterRuns === 4) batter.fours += 1;
    if (batterRuns === 6) batter.sixes += 1;
  }

  if (delivery.wickets && delivery.wickets.length > 0) {
    delivery.wickets.forEach((w) => {
      innings.wickets += 1;
      bowler.wickets += 1;
      const outBatter = w.player_out;
      if (!innings.batters[outBatter]) {
        innings.batters[outBatter] = {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          out: null,
        };
      }
      innings.batters[outBatter].out = {
        kind: w.kind,
        bowler: bowlerName,
        fielder: w.fielders?.[0] || null,
      };
    });
  }

  innings.oversDisplay = formatOvers(innings.balls);
  innings.runRate = calcRunRate(innings.runs, innings.balls);
  innings.currentBowler = bowlerName;

  if (!innings.currentBatters.includes(batterName)) {
    if (innings.currentBatters.length < 2) {
      innings.currentBatters.push(batterName);
    } else {
      innings.currentBatters[0] = innings.currentBatters[1];
      innings.currentBatters[1] = batterName;
    }
  }

  return {
    ...state,
    [inningsKey]: innings,
    currentInnings: inning,
  };
}
