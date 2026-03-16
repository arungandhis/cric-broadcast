import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

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

export default function Scoreboard({ matchId }) {
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

  const handleBall = useCallback(
    (rawEvent) => {
      if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

      const inn = rawEvent.inning;
      const team = rawEvent.team;
      const over = rawEvent.over;
      const ball = rawEvent.ball;
      const delivery = rawEvent.event;

      setCurrentInnings(inn);

      setInnings((prev) => {
        const curr = { ...prev[inn] };

        if (!curr.team && team) curr.team = team;

        const runsObj = delivery.runs || {};
        const totalRuns = runsObj.total || 0;
        const batterRuns = runsObj.batter || 0;

        const extrasObj = delivery.extras || {};
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
                newBatter.dismissal = {
                  kind: w.kind,
                  fielders: w.fielders || [],
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

          newBowler.wides += wides;
          newBowler.noballs += noballs;

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
          const inn1 = prev[1];
          if (target == null && inn1.runs > 0) {
            setTarget(inn1.runs + 1);
            setMaxOvers(inn1.over + 1);
          }
          return prev;
        });
      }
    },
    [target, maxOvers]
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

                {/* FIXED: ALWAYS FORMAT DISMISSAL */}
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
                  {overs}.{balls}
                </td>
                <td align="center">{s.runs}</td>
                <td align="center">{s.wickets}</td>
                <td align="center">{s.wides || 0}</td>
                <td align="center">{s.noballs || 0}</td>
                <td align="center">{econ}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderFOW = (fow) => {
    if (!fow || fow.length === 0) return null;
    return (
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <strong>Fall of wickets:</strong>{" "}
        {fow.map((w, idx) => (
          <span key={idx}>
            {w.score}/{w.wicket} ({w.player}, {w.overStr})
            {idx < fow.length - 1 ? ", " : ""}
          </span>
        ))}
      </div>
    );
  };

  const renderExtrasLine = (inn) => {
    const e = inn.extras;
    return (
      <div style={{ fontSize: 14, marginTop: 5 }}>
        Extras: {e.total} (w {e.wides}, nb {e.noballs}, lb {e.legbyes}, b{" "}
        {e.byes}, p {e.penalty})
      </div>
    );
  };

  return (
    <div
      style={{
        background: "#111",
        padding: 20,
        borderRadius: 10,
        color: "white",
        marginTop: 20,
        fontFamily: "sans-serif",
      }}
    >
      <h2>Scoreboard</h2>

      {inn1.team && (
        <div style={{ marginBottom: 20 }}>
          <h3>Innings 1 — {inn1.team}</h3>
          <div style={{ fontSize: 22 }}>
            {inn1.runs}/{inn1.wickets} ({formatOvers(inn1.over, inn1.ball)}){" "}
            <span style={{ fontSize: 14, opacity: 0.8 }}>RR: {inn1RR}</span>
          </div>
          {renderExtrasLine(inn1)}
          {renderBattersTable(inn1.batters)}
          {renderBowlersTable(inn1.bowlers)}
          {renderFOW(inn1.fow)}
        </div>
      )}

      {inn2.team && (
        <div style={{ marginBottom: 20 }}>
          <h3>Innings 2 — {inn2.team}</h3>
          <div style={{ fontSize: 22 }}>
            {inn2.runs}/{inn2.wickets} ({formatOvers(inn2.over, inn2.ball)}){" "}
            <span style={{ fontSize: 14, opacity: 0.8 }}>RR: {inn2RR}</span>
            {target && (
              <>
                {"  "} | Target: {target}
                {"  "} | RRR: {rrr}
              </>
            )}
          </div>
          {renderExtrasLine(inn2)}
          {renderBattersTable(inn2.batters)}
          {renderBowlersTable(inn2.bowlers)}
          {renderFOW(inn2.fow)}
        </div>
      )}

      <div style={{ opacity: 0.7, marginTop: 10 }}>
        Updating: Innings {currentInnings}
      </div>
    </div>
  );
}
