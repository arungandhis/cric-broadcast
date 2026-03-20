// src/helpers/inningsSummary.js
export const generateInningsSummary = (inn, inningsNumber) => {
  if (!inn.team) return null;

  const team = inn.team;
  const score = `${inn.score.runs}/${inn.score.wickets} (${inn.score.overs}.${inn.score.balls})`;

  const battersSorted = Object.entries(inn.batters)
    .sort((a, b) => b[1].runs - a[1].runs)
    .slice(0, 3);

  const bowlersSorted = Object.entries(inn.bowlers)
    .sort((a, b) => b[1].wickets - a[1].wickets)
    .slice(0, 3);

  const topPartnerships = [...inn.partnerships]
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 2);

  const lines = [];

  lines.push(`📘 INNINGS ${inningsNumber} SUMMARY — ${team}`);
  lines.push(`They finished on ${score}.`);
  lines.push("");

  lines.push("Batting Highlights:");
  battersSorted.forEach(([name, b]) => {
    lines.push(`• ${name}: ${b.runs}(${b.balls}) with ${b.fours}×4 and ${b.sixes}×6`);
  });
  if (battersSorted.length === 0) lines.push("• No batting data available.");
  lines.push("");

  lines.push("Bowling Highlights:");
  bowlersSorted.forEach(([name, bw]) => {
    const overs = Math.floor(bw.balls / 6);
    const balls = bw.balls % 6;
    lines.push(
      `• ${name}: ${bw.wickets} wickets for ${bw.runs} runs in ${overs}.${balls} overs`
    );
  });
  if (bowlersSorted.length === 0) lines.push("• No bowling data available.");
  lines.push("");

  lines.push("Key Partnerships:");
  topPartnerships.forEach((p) => {
    lines.push(`• ${p.runs} runs between ${p.batters.join(" & ")}`);
  });
  if (topPartnerships.length === 0) lines.push("• No major partnerships recorded.");
  lines.push("");

  const totalBalls = inn.score.overs * 6 + inn.score.balls;
  const rr = totalBalls ? ((inn.score.runs * 6) / totalBalls).toFixed(2) : "0.00";
  lines.push(`Overall run rate: ${rr} runs per over.`);

  if (inn.fallOfWickets.length > 0) {
    const lastWicket = inn.fallOfWickets[inn.fallOfWickets.length - 1];
    lines.push(
      `They lost their last wicket at ${lastWicket.score} in over ${lastWicket.over}.`
    );
  }

  lines.push("");
  lines.push("A complete innings with key moments, momentum swings, and standout performances.");

  return lines.join("\n");
};
