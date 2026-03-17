// frontend/src/engine/commentaryEngine.js

export function generateIPLCommentary(ball, context = {}) {
  const {
    batter,
    bowler,
    runs,
    extras = {},
    wicket,
    over,
    ball: ballNumber,
  } = ball;

  const { ballsThisOver = [], batterRuns = 0, bowlerDots = 0 } = context;

  const event = wicket
    ? "wicket"
    : runs === 6
    ? "six"
    : runs === 4
    ? "four"
    : runs > 0
    ? "runs"
    : extras.wides || extras.noballs
    ? "extra"
    : "dot";

  const hype = [];

  // POWERPLAY HYPE
  if (over < 6) {
    hype.push("Powerplay fireworks!");
    hype.push("Field is up — danger everywhere!");
    hype.push("This is where momentum shifts!");
  }

  // PRESSURE BUILDUP
  if (bowlerDots >= 2 && event === "dot") {
    hype.push(`${bowler} is turning the screws!`);
    hype.push(`Dot after dot — pressure sky high!`);
  }

  // BATTER FORM
  if (batterRuns >= 20) {
    hype.push(`${batter} is looking dangerous!`);
    hype.push(`Everything off the middle from ${batter}!`);
  }

  // OVER MOMENTUM
  const overRuns = ballsThisOver.reduce((a, b) => a + b, 0);
  if (overRuns >= 10) {
    hype.push(`This over is turning into a nightmare for ${bowler}!`);
    hype.push(`Runs flowing like a river!`);
  }

  switch (event) {
    case "dot":
      return pick([
        `${bowler} nails the length — ${batter} can’t get it away!`,
        `Dot ball! ${bowler} roaring in the Powerplay!`,
        `${batter} tries to break free but ${bowler} keeps it tight!`,
        ...hype,
      ]);

    case "runs":
      return pick([
        `${batter} works it away — they’ll steal ${runs}!`,
        `Soft hands, smart cricket — ${runs} more.`,
        `${runs} to the total, keeping the scoreboard ticking.`,
        ...hype,
      ]);

    case "four":
      return pick([
        `FOUR! ${batter} threads the needle — pure class!`,
        `Cracked away! ${batter} sends it racing to the rope!`,
        `That’s a tracer bullet from ${batter}!`,
        ...hype,
      ]);

    case "six":
      return pick([
        `SIX! ${batter} sends it into the night sky!`,
        `That’s MASSIVE! ${batter} absolutely launches it!`,
        `Out of here! ${batter} with a monster hit!`,
        ...hype,
      ]);

    case "extra":
      if (extras.wides)
        return pick([
          `Wide! ${bowler} losing control under pressure!`,
          `Loose delivery — umpire stretches the arms.`,
          ...hype,
        ]);

      if (extras.noballs)
        return pick([
          `No-ball! ${bowler} oversteps — FREE HIT coming!`,
          `Huge moment — ${bowler} gifts a no-ball!`,
          ...hype,
        ]);

      return pick([`Extras leaking — this could hurt.`, ...hype]);

    case "wicket":
      return pick([
        `GONE! ${bowler} breaks through — ${batter} has to walk!`,
        `EDGED AND TAKEN! ${bowler} roars in celebration!`,
        `TIMBER! ${batter} is cleaned up — what a moment!`,
        `Crowd ERUPTS! ${bowler} delivers a game‑changer!`,
        ...hype,
      ]);
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
