import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

function oversToFloat(over, ball) {
  return over + ball / 6;
}

function formatOvers(over, ball) {
  return `${over}.${ball}`;
}

export default function Scoreboard({ matchId }) {
  const [innings, setInnings] = useState({
    1: {
      team: "",
      runs: 0,
      wickets: 0,
      over: 0,
      ball: 0,
      batters: {}, // name -> { runs, balls, fours, sixes, out }
      bowlers: {}, // name -> { balls, runs, wickets }
      fow: [],     // [{ score, wicket, player, overStr }]
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
    },
  });

  const [currentInnings, setCurrentInnings] = useState(1);
  const [target, setTarget] = useState(null);
  const [maxOvers, setMaxOvers] = useState(null); // inferred from innings 1

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

        // Set team name
        if (!curr.team && team) {
          curr.team = team;
        }

        const runsObj = delivery.runs || {};
        const totalRuns = runsObj.total || 0;
        const batterRuns = runsObj.batter || 0;

        // Update team score
        const newRuns = curr.runs + totalRuns;
        let newWickets = curr.wickets;

        // Wickets + FOW
        if (delivery.wickets && delivery.wickets.length > 0) {
          delivery.wickets.forEach((w) => {
            newWickets += 1;
            curr.fow = [
              ...curr.fow,
              {
                score: newRuns,
                wicket: newWickets,
                player: w.player_out,
                overStr: formatOvers(over, ball),
              },
            ];
          });
        }

        // Update batters
        const batterName = delivery.batter;
        if (batterName) {
          const prevBatter = curr.batters[batterName] || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            out: false,
          };

          const newBatter = { ...prevBatter };
          newBatter.runs += batterRuns;
          newBatter.balls += 1;

          if (batterRuns === 4) newBatter.fours += 1;
          if (batterRuns === 6) newBatter.sixes += 1;

          // Mark out if this batter is dismissed
          if (delivery.wickets) {
            delivery.wickets.forEach((w) => {
              if (w.player_out === batterName) {
                newBatter.out = true;
              }
            });
          }

          curr.batters = {
            ...curr.batters,
            [batterName]: newBatter,
          };
        }

        // Update bowlers
        const bowlerName = delivery.bowler;
        if (bowlerName) {
          const prevBowler = curr.bowlers[bowlerName] || {
            balls: 0,
            runs: 0,
            wickets: 0,
          };

          const newBowler = { ...prevBowler };
          newBowler.balls += 1;
          newBowler.runs += totalRuns;

          if (delivery.wickets && delivery.wickets.length > 0) {
            newBowler.wickets += delivery.wickets.length;
          }

          curr.bowlers = {
            ...curr.bowlers,
            [bowlerName]: newBowler,
          };
        }

        // Update over/ball from backend (Cricsheet keys)
        curr.runs = newRuns;
        curr.wickets = newWickets;
        curr.over = over;
        curr.ball = ball;

        return {
          ...prev,
          [inn]: curr,
        };
      });

      // When we see innings 2 for the first time, infer target and max overs
      if (inn === 2) {
        setInnings((prev) => {
          const inn1 = prev[1];
          if (target == null && inn1.runs > 0) {
            setTarget(inn1.runs + 1);
            const maxOv = inn1.over + 1; // last over index + 1
            setMaxOvers(maxOv);
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
            <th>Status</th>
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
                <td align="center">{s.out ? "out" : "not out"}</td>
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

      {/* INNINGS 1 */}
      {inn1.team && (
        <div style={{ marginBottom: 20 }}>
          <h3>Innings 1 — {inn1.team}</h3>
          <div style={{ fontSize: 22 }}>
            {inn1.runs}/{inn1.wickets} ({formatOvers(inn1.over, inn1.ball)}){" "}
            <span style={{ fontSize: 14, opacity: 0.8 }}>RR: {inn1RR}</span>
          </div>
          {renderBattersTable(inn1.batters)}
          {renderBowlersTable(inn1.bowlers)}
          {renderFOW(inn1.fow)}
        </div>
      )}

      {/* INNINGS 2 */}
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
