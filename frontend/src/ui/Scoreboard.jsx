import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";
import { generateIPLCommentary } from "../engine/commentaryEngine";

function oversToFloat(over, ball) {
  return over + ball / 6;
}

function formatOvers(over, ball) {
  return `${over}.${ball}`;
}

function formatDismissal(d) {
  if (!d) return "out";

  switch (d.kind) {
    case "caught":
      return d.fielders?.length
        ? `c ${d.fielders.join(", ")} b ${d.bowler}`
        : `c ? b ${d.bowler}`;
    case "bowled":
      return `b ${d.bowler}`;
    case "lbw":
      return `lbw b ${d.bowler}`;
    case "stumped":
      return d.fielders?.length
        ? `st ${d.fielders.join(", ")} b ${d.bowler}`
        : `st ? b ${d.bowler}`;
    case "run out":
      return d.fielders?.length
        ? `run out (${d.fielders.join(", ")})`
        : "run out";
    case "hit wicket":
      return `hit wicket b ${d.bowler}`;
    case "retired hurt":
      return "retired hurt";
    default:
      return d.kind;
  }
}

function formatBallLine(over, ball, delivery) {
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

function summarizeOver(balls) {
  if (balls.length === 0) return "";
  return `This over so far: ${balls.join(", ")}`;
}

function partnershipLine(p) {
  if (p.runs < 20) return null;
  return `Partnership now ${p.runs} off ${p.balls} balls.`;
}

function pressureLine(rrr, remainingRuns) {
  if (!rrr || rrr === "-" || rrr === "Achieved") return null;
  const r = parseFloat(rrr);
  if (Number.isNaN(r)) return null;
  if (r >= 10) return `Pressure rising! Required rate at ${rrr}.`;
  if (remainingRuns !== null && remainingRuns <= 12)
    return `Just a couple of hits needed now!`;
  return null;
}

function bowlerPressureLine(bowler, stats) {
  const s = stats[bowler];
  if (!s) return null;
  if (s.dots >= 3) return `${bowler} building serious pressure with dot balls!`;
  if (s.runsInOver >= 12) return `${bowler} under the pump this over!`;
  return null;
}

function crowdReaction(runs, wicket) {
  if (wicket) return "Crowd ERUPTS as the wicket falls!";
  if (runs === 6) return "Crowd goes wild — that’s out of the stadium!";
  if (runs === 4) return "Crowd loves that boundary!";
  if (runs === 0) return "Crowd murmurs… dot ball pressure.";
  return null;
}

export default function Scoreboard({ matchId }) {
  const [matchInfo, setMatchInfo] = useState({
    teamA: "",
    teamB: "",
    tossWinner: "",
    tossDecision: "",
  });

  const [commentary, setCommentary] = useState([]);

  const [innings, setInnings] = useState({
    1: {
      team: "",
      runs: 0,
      wickets: 0,
      over: 0,
      ball: 0,
      batters: {},
      bowlers: {},
      fow: [],
      extras: {
        wides: 0,
        noballs: 0,
        legbyes: 0,
        byes: 0,
        penalty: 0,
        total: 0,
      },
    },
    2: {
      team: "",
      runs: 0,
      wickets: 0,
      over: 0,
      ball: 0,
      batters: {},
      bowlers: {},
      fow: [],
      extras: {
        wides: 0,
        noballs: 0,
        legbyes: 0,
        byes: 0,
        penalty: 0,
        total: 0,
      },
    },
  });

  const [currentInnings, setCurrentInnings] = useState(1);
  const [target, setTarget] = useState(null);
  const [maxOvers, setMaxOvers] = useState(null);

  const [ballsThisOver, setBallsThisOver] = useState([]);
  const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });
  const [bowlerStats, setBowlerStats] = useState({});

  const handleMeta = useCallback((meta) => {
    setMatchInfo({
      teamA: meta.teamA,
      teamB: meta.teamB,
      tossWinner: meta.tossWinner,
      tossDecision: meta.tossDecision,
    });
  }, []);

  const handleBall = useCallback(
    (rawEvent) => {
      if (rawEvent.type === "meta") {
        handleMeta(rawEvent);
        return;
      }

      if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

      const inn = rawEvent.inning;
      const team = rawEvent.team;
      const over = rawEvent.over;
      const ball = rawEvent.ball;
      const delivery = rawEvent.event;

      setCurrentInnings(inn);

      const runsObj = delivery.runs || {};
      const totalRuns = runsObj.total || 0;
      const extrasObj = delivery.extras || {};
      const wicket = delivery.wickets?.length > 0;

      // Compute RRR snapshot
      const inn2 = innings[2];
      const inn2OversFloat = oversToFloat(inn2.over, inn2.ball);
      let rrr = "-";
      let remainingRuns = null;

      if (target && maxOvers && inn2OversFloat < maxOvers) {
        remainingRuns = target - inn2.runs;
        const remainingOvers = maxOvers - inn2OversFloat;
        if (remainingRuns > 0 && remainingOvers > 0) {
          rrr = (remainingRuns / remainingOvers).toFixed(2);
        } else if (remainingRuns <= 0) {
          rrr = "Achieved";
        }
      }

      // Build over sequence
      const thisBallSymbol =
        totalRuns === 0 ? (wicket ? "W" : 0) : totalRuns;
      const overBallsNow = [...ballsThisOver, thisBallSymbol];

      // Commentary lines
      const ballLine = formatBallLine(over, ball, delivery);
      const hypeLine = generateIPLCommentary(
        {
          batter: delivery.batter,
          bowler: delivery.bowler,
          runs: totalRuns,
          extras: extrasObj,
          wicket,
          over,
          ball,
        },
        {}
      );

      const overSummary = summarizeOver(overBallsNow);

      const nextPartnership = {
        runs: partnership.runs + totalRuns,
        balls: partnership.balls + 1,
      };
      const pLine = partnershipLine(nextPartnership);

      const pressure = pressureLine(rrr, remainingRuns);

      const currentBowler = delivery.bowler;
      const currentBowlerStats = bowlerStats[currentBowler] || {
        dots: 0,
        runsInOver: 0,
      };
      const nextBowlerStats = {
        dots: totalRuns === 0 ? currentBowlerStats.dots + 1 : 0,
        runsInOver: currentBowlerStats.runsInOver + totalRuns,
      };
      const bowlerPressure = bowlerPressureLine(currentBowler, {
        ...bowlerStats,
        [currentBowler]: nextBowlerStats,
      });

      const crowd = crowdReaction(totalRuns, wicket);

      const lines = [
        hypeLine,
        ballLine,
        overSummary,
        pLine,
        pressure,
        bowlerPressure,
        crowd,
      ].filter(Boolean);

      setCommentary((prev) => [...lines, ...prev].slice(0, 100));

      // Update over tracking
      setBallsThisOver((prev) => {
        const updated = [...prev, thisBallSymbol];
        if (ball === 5) {
          const endSummary = `End of over ${over}: ${summarizeOver(updated)}`;
          setCommentary((prevC) => [endSummary, ...prevC]);
          return [];
        }
        return updated;
      });

      // Update partnership
      setPartnership((prev) =>
        wicket
          ? { runs: 0, balls: 0 }
          : { runs: prev.runs + totalRuns, balls: prev.balls + 1 }
      );

      // Update bowler spell
      setBowlerStats((prev) => {
        const prevStats = prev[currentBowler] || {
          dots: 0,
          runsInOver: 0,
        };
        let newStats = {
          dots: totalRuns === 0 ? prevStats.dots + 1 : 0,
          runsInOver: prevStats.runsInOver + totalRuns,
        };
        if (ball === 5) {
          newStats = { dots: 0, runsInOver: 0 };
        }
        return { ...prev, [currentBowler]: newStats };
      });

      // SCORING LOGIC (unchanged)
      setInnings((prev) => {
        const curr = { ...prev[inn] };

        if (!curr.team && team) curr.team = team;

        const batterRuns = runsObj.batter || 0;

        const wides = extrasObj.wides || 0;
        const noballs = extrasObj.noballs || 0;
        const legbyes = extrasObj.legbyes || 0;
        const byes = extrasObj.byes || 0;
        const penalty = extrasObj.penalty || 0;

        curr.extras.wides += wides;
        curr.extras.noballs += noballs;
        curr.extras.legbyes += legbyes;
        curr.extras.byes += byes;
        curr.extras.penalty += penalty;
        curr.extras.total += wides + noballs + legbyes + byes + penalty;

        const newRuns = curr.runs + totalRuns;
        let newWickets = curr.wickets;

        if (delivery.wickets && delivery.wickets.length > 0) {
          delivery.wickets.forEach((w) => {
            newWickets += 1;
            curr.fow.push({
              score: newRuns,
              wicket: newWickets,
              player: w.player_out,
              overStr: formatOvers(over, ball),
            });
          });
        }

        const batterName = delivery.batter;
        if (batterName) {
          const prevBatter = curr.batters[batterName] || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            out: false,
            dismissal: null,
          };

          const newBatter = { ...prevBatter };
          newBatter.runs += batterRuns;
          newBatter.balls += 1;

          if (batterRuns === 4) newBatter.fours += 1;
          if (batterRuns === 6) newBatter.sixes += 1;

          if (delivery.wickets) {
            delivery.wickets.forEach((w) => {
              if (w.player_out === batterName) {
                newBatter.out = true;

                const normalizedFielders = (w.fielders || []).map((f) => {
                  if (typeof f === "string") return f;
                  if (typeof f === "object") {
                    return (
                      f.name ||
                      f.player ||
                      f.fielder ||
                      Object.values(f)[0] ||
                      "Unknown"
                    );
                  }
                  return String(f);
                });

                newBatter.dismissal = {
                  kind: w.kind,
                  fielders: normalizedFielders,
                  bowler: delivery.bowler || null,
                };
              }
            });
          }

          curr.batters[batterName] = newBatter;
        }

        const bowlerName = delivery.bowler;
        if (bowlerName) {
          const prevBowler = curr.bowlers[bowlerName] || {
            balls: 0,
            runs: 0,
            wickets: 0,
            wides: 0,
            noballs: 0,
          };

          const newBowler = { ...prevBowler };
          newBowler.balls += 1;
          newBowler.runs += totalRuns;

          if (delivery.wickets) {
            newBowler.wickets += delivery.wickets.length;
          }

          newBowler.wides += extrasObj.wides || 0;
          newBowler.noballs += extrasObj.noballs || 0;

          curr.bowlers[bowlerName] = newBowler;
        }

        curr.runs = newRuns;
        curr.wickets = newWickets;
        curr.over = over;
        curr.ball = ball;

        return { ...prev, [inn]: curr };
      });

      if (inn === 2) {
        setInnings((prev) => {
          const inn1Local = prev[1];
          if (target == null && inn1Local.runs > 0) {
            setTarget(inn1Local.runs + 1);
            setMaxOvers(inn1Local.over + 1);
          }
          return prev;
        });
      }
    },
    [
      handleMeta,
      innings,
      ballsThisOver,
      partnership,
      bowlerStats,
      target,
      maxOvers,
    ]
  );

  useMatchEvents(matchId, handleBall);

  const inn1 = innings[1];
  const inn2 = innings[2];

  const inn1OversFloat = oversToFloat(inn1.over, inn1.ball);
  const inn2OversFloat = oversToFloat(inn2.over, inn2.ball);

  const inn1RR =
    inn1OversFloat > 0 ? (inn1.runs / inn1OversFloat).toFixed(2) : "-";
  const inn2RR =
    inn2OversFloat > 0 ? (inn2.runs / inn2OversFloat).toFixed(2) : "-";

  let rrr = "-";
  if (target && maxOvers && inn2OversFloat < maxOvers) {
    const remainingRuns = target - inn2.runs;
    const remainingOvers = maxOvers - inn2OversFloat;
    if (remainingRuns > 0 && remainingOvers > 0) {
      rrr = (remainingRuns / remainingOvers).toFixed(2);
    } else if (remainingRuns <= 0) {
      rrr = "Achieved";
    }
  }

  const renderBattersTable = (batters) => {
    const entries = Object.entries(batters);
    if (entries.length === 0) return null;

    return (
      <table style={{ width: "100%", marginTop: 10, fontSize: 14 }}>
        <thead>
          <tr>
            <th align="left">Batter</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
            <th>Dismissal</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, s]) => {
            const sr =
              s.balls > 0 ? ((s.runs * 100) / s.balls).toFixed(1) : "-";
            return (
              <tr key={name}>
                <td align="left">{name}</td>
                <td align="center">{s.runs}</td>
                <td align="center">{s.balls}</td>
                <td align="center">{s.fours}</td>
                <td align="center">{s.sixes}</td>
                <td align="center">{sr}</td>
                <td align="center">
                  {s.out ? formatDismissal(s.dismissal) : "not out"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderBowlersTable = (bowlers) => {
    const entries = Object.entries(bowlers);
    if (entries.length === 0) return null;

    return (
      <table style={{ width: "100%", marginTop: 10, fontSize: 14 }}>
        <thead>
          <tr>
            <th align="left">Bowler</th>
            <th>O</th>
            <th>R</th>
            <th>W</th>
            <th>Wd</th>
            <th>Nb</th>
            <th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, s]) => {
            const overs = Math.floor(s.balls / 6);
            const balls = s.balls % 6;
            const econ =
              s.balls > 0 ? ((s.runs * 6) / s.balls).toFixed(2) : "-";
            return (
              <tr key={name}>
                <td align="left">{name}</td>
                <td align="center">
                  {
