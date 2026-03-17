// src/engine/commentaryEngine.js

export function generateIPLCommentary(event, context = {}) {
  const { batter, bowler, runs, wicket, over, ball } = event;

  // WICKET
  if (wicket) {
    const wicketLines = [
      `GONE! ${bowler} strikes — huge moment!`,
      `Cleaned up! ${batter} has to walk back.`,
      `Breakthrough! ${bowler} gets the big wicket of ${batter}.`,
      `What a delivery! ${batter} is dismissed.`,
    ];
    return wicketLines[Math.floor(Math.random() * wicketLines.length)];
  }

  // SIX
  if (runs === 6) {
    const sixLines = [
      `SIX! ${batter} launches it into the stands!`,
      `That's massive! ${batter} sends it out of the park!`,
      `What a hit! ${batter} muscles a huge six!`,
      `Clean strike! ${batter} with a towering six!`,
    ];
    return sixLines[Math.floor(Math.random() * sixLines.length)];
  }

  // FOUR
  if (runs === 4) {
    const fourLines = [
      `FOUR! ${batter} finds the gap beautifully!`,
      `Cracking shot! ${batter} drives it for four.`,
      `Lovely timing — ${batter} gets a boundary.`,
      `That's a bullet! ${batter} smashes a four.`,
    ];
    return fourLines[Math.floor(Math.random() * fourLines.length)];
  }

  // DOT BALL
  if (runs === 0) {
    const dotLines = [
      `Dot ball — pressure building.`,
      `${bowler} keeps it tight. Dot.`,
      `Good delivery from ${bowler}. No run.`,
      `${batter} defends. Dot ball.`,
    ];
    return dotLines[Math.floor(Math.random() * dotLines.length)];
  }

  // SINGLES / DOUBLES / TRIPLES
  const miscLines = [
    `${batter} rotates strike — ${runs} run.`,
    `Smart cricket — ${runs} taken.`,
    `${runs} run added to the total.`,
    `${batter} nudges it for ${runs}.`,
  ];
  return miscLines[Math.floor(Math.random() * miscLines.length)];
}
