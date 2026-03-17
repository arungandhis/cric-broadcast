// src/engine/commentaryHelpers.js

export function formatBallLine(over, ball, delivery) {
  const batter = delivery.batter;
  const bowler = delivery.bowler;

  const runsObj = delivery.runs || {};
  const totalRuns = runsObj.total || 0;

  const extras = delivery.extras || {};
  const wides = extras.wides || 0;
  const noballs = extras.noballs || 0;

  if (delivery.wickets?.length > 0) {
    const w = delivery.wickets[0];
    return `${over}.${ball} — WICKET! ${w.player_out} ${w.kind} b ${bowler}`;
  }

  if (wides > 0) return `${over}.${ball} — Wide ball from ${bowler}`;
  if (noballs > 0) return `${over}.${ball} — No-ball from ${bowler}`;

  if (totalRuns === 0)
    return `${over}.${ball} — Dot ball. ${batter} defends.`;

  return `${over}.${ball} — ${batter} scores ${totalRuns} run(s).`;
}

export function summarizeOver(balls) {
  if (balls.length === 0) return "";
  return `This over so far: ${balls.join(", ")}`;
}

export function partnershipLine(p) {
  if (p.runs < 20) return null;
  return `Partnership now ${p.runs} off ${p.balls} balls.`;
}

export function pressureLine(rrr, remainingRuns) {
  if (!rrr || rrr === "-" || rrr === "Achieved") return null;

  const r = parseFloat(rrr);
  if (Number.isNaN(r)) return null;

  if (r >= 10) return `Pressure rising! Required rate at ${rrr}.`;
  if (remainingRuns !== null && remainingRuns <= 12)
    return `Just a couple of hits needed now!`;

  return null;
}

export function bowlerPressureLine(bowler, stats) {
  const s = stats[bowler];
  if (!s) return null;

  if (s.dots >= 3) return `${bowler} building serious pressure with dot balls!`;
  if (s.runsInOver >= 12) return `${bowler} under the pump this over!`;

  return null;
}

export function crowdReaction(runs, wicket) {
  if (wicket) return "Crowd ERUPTS as the wicket falls!";
  if (runs === 6) return "Crowd goes wild — that's out of the stadium!";
  if (runs === 4) return "Crowd loves that boundary!";
  if (runs === 0) return "Crowd murmurs… dot ball pressure.";
  return null;
}
