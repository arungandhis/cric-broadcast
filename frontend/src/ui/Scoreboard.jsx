import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";

export default function Scoreboard() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId");

  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [balls, setBalls] = useState([]); // raw ball events

  const [score, setScore] = useState({
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
  });

  const [batters, setBatters] = useState({}); // name -> { runs, balls, fours, sixes, out }
  const [bowlers, setBowlers] = useState({}); // name -> { balls, runs, wickets }
  const [fallOfWickets, setFallOfWickets] = useState([]); // { score, over, player }
  const [partnerships, setPartnerships] = useState([]); // completed partnerships
  const [currentPartnership, setCurrentPartnership] = useState({
    runs: 0,
    batters: new Set(),
  });

  const [manhattan, setManhattan] = useState([]); // runs per over
  const [commentary, setCommentary] = useState([]); // latest first

  const formatOvers = (overs, balls) => `${overs}.${balls}`;

  const isLegalBall = (event) => {
    const extras = event.extras || {};
    if (extras.wides || extras.no_balls) return false;
    return true;
  };

  const generateCommentary = (data, totalScoreBefore, wicketsBefore) => {
    const { event, over, ball, team } = data;
    const batter = event.batter;
    const bowler = event.bowler;
    const runs = event.runs?.batter || 0;
    const total = event.runs?.total || 0;
    const extras = event.extras || {};
    const wicket = event.wickets && event.wickets.length > 0 ? event.wickets[0] : null;

    let line = "";

    if (wicket) {
      const kind = wicket.kind;
      const outName = wicket.player_out;
      line = `${over}.${ball} ${bowler} to ${batter} — OUT! ${outName} ${kind}!.`;
    } else if (extras.wides) {
      line = `${over}.${ball} ${bowler} sprays it wide — ${extras.wides} run(s) to ${team}.`;
    } else if (extras.no_balls) {
      line = `${over}.${ball} No-ball from ${bowler}! Free hit coming up.`;
    } else if (runs === 0 && total === 0) {
      line = `${over}.${ball} ${bowler} to ${batter} — dot ball, pressure building.`;
    } else if (runs === 4) {
      line = `${over}.${ball} ${bowler} to ${batter} — FOUR! Crunched to the fence.`;
    } else if (runs === 6) {
      line = `${over}.${ball} ${bowler} to ${batter} — SIX! That’s out of the park!`;
    } else {
      line = `${over}.${ball} ${bowler} to ${batter} — ${total} run(s).`;
    }

    const newTotal = totalScoreBefore + total;
    const newWkts = wicketsBefore + (wicket ? 1 : 0);
    line += ` Score: ${newTotal}/${newWkts}.`;

    return line;
  };

  useEffect(() => {
    if (!matchId) {
      setStatus("no-match-id");
      return;
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/match/${matchId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "meta") {
        setMeta(data);
      } else if (data.type === "ball") {
        setBalls((prev) => [...prev, data]);

        const event = data.event;
        const totalRuns = event.runs?.total || 0;
        const batterName = event.batter;
        const bowlerName = event.bowler;
        const wicketArr = event.wickets || [];
        const isWicket = wicketArr.length > 0;
        const legal = isLegalBall(event);

        // Snapshot before updates for commentary/FOW
        const prevRuns = score.runs;
        const prevWickets = score.wickets;

        // Score
        setScore((prev) => {
          let runs = prev.runs + totalRuns;
          let wickets = prev.wickets + (isWicket ? wicketArr.length : 0);
          let overs = prev.overs;
          let balls = prev.balls;

          if (legal) {
            balls += 1;
            if (balls === 6) {
              overs += 1;
              balls = 0;
            }
          }

          return { runs, wickets, overs, balls };
        });

        // Batters
        setBatters((prev) => {
          const next = { ...prev };
          if (!next[batterName]) {
            next[batterName] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
          }
          const b = next[batterName];
          const batRuns = event.runs?.batter || 0;

          b.runs += batRuns;
          if (legal) b.balls += 1;
          if (batRuns === 4) b.fours += 1;
          if (batRuns === 6) b.sixes += 1;
          if (isWicket && wicketArr[0].player_out === batterName) {
            b.out = true;
          }

          return next;
        });

        // Bowlers
        setBowlers((prev) => {
          const next = { ...prev };
          if (!next[bowlerName]) {
            next[bowlerName] = { balls: 0, runs: 0, wickets: 0 };
          }
          const bw = next[bowlerName];

          bw.runs += totalRuns;
          if (legal) bw.balls += 1;
          if (isWicket) bw.wickets += wicketArr.length;

          return next;
        });

        // Fall of wickets
        if (isWicket) {
          setFallOfWickets((prev) => {
            const overStr = `${data.over}.${data.ball}`;
            const player = wicketArr[0].player_out;
            const totalAfter = prevRuns + totalRuns;
            const wicketNumber = prevWickets + 1;
            return [
              ...prev,
              {
                score: `${totalAfter}/${wicketNumber}`,
                over: overStr,
                player,
              },
            ];
          });
        }

        // Partnerships
        setCurrentPartnership((prev) => {
          const next = { ...prev, batters: new Set(prev.batters) };
          next.runs += totalRuns;
          next.batters.add(batterName);

          if (isWicket) {
            setPartnerships((old) => [
              ...old,
              {
                runs: next.runs,
                batters: Array.from(next.batters),
              },
            ]);
            return { runs: 0, batters: new Set() };
          }

          return next;
        });

        // Manhattan
        setManhattan((prev) => {
          const idx = data.over;
          const copy = [...prev];
          if (copy[idx] == null) copy[idx] = 0;
          copy[idx] += totalRuns;
          return copy;
        });

        // Commentary
        setCommentary((prev) => {
          const line = generateCommentary(data, prevRuns, prevWickets);
          return [line, ...prev].slice(0, 30);
        });
      } else if (data.type === "end") {
        // If you want to set a target for second innings, you can do it here
        // Example (only if first innings):
        // setMeta(prev => ({
        //   ...prev,
        //   target: { runs: score.runs + 1, overs: prev.event?.overs || 50 }
        // }));
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
    };

    return () => ws.close();
  }, [matchId]); // IMPORTANT: only depend on matchId

  const runRate = useMemo(() => {
    const totalBalls = score.overs * 6 + score.balls;
    if (totalBalls === 0) return 0;
    return (score.runs * 6) / totalBalls;
  }, [score]);

  const requiredRunRate = useMemo(() => {
    if (!meta || !meta.target) return null;
    const target = meta.target; // { runs, overs }
    const totalBalls = target.overs * 6;
    const ballsUsed = score.overs * 6 + score.balls;
    const ballsLeft = totalBalls - ballsUsed;
    const runsNeeded = target.runs - score.runs;
    if (ballsLeft <= 0 || runsNeeded <= 0) return 0;
    return (runsNeeded * 6) / ballsLeft;
  }, [meta, score]);

  const renderManhattan = () => {
    if (!manhattan.length) return null;
    const filtered = manhattan.filter((v) => v != null);
    if (!filtered.length) return null;
    const max = Math.max(...filtered);
    if (!max) return null;

    return (
      <div style={{ marginTop: 10 }}>
        <div>Manhattan (runs per over)</div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          {manhattan.map((runs, i) => {
            if (runs == null) {
              return (
                <div key={i} style={{ width: 10, height: 2, background: "#333" }} />
              );
            }
            const height = (runs / max) * 60;
            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 12,
                    height,
                    background: "#4caf50",
                  }}
                />
                <div style={{ fontSize: 10 }}>{i}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 20, color: "white", fontFamily: "system-ui" }}>
      <h2>Live Scoreboard</h2>

      <div>Status: {status}</div>
      <div>Match ID: {matchId || "None"}</div>

      {meta && (
        <div style={{ marginTop: 10 }}>
          <div>
            <strong>{meta.teams?.join(" vs ")}</strong>
          </div>
          {meta.event && (
            <div>
              {meta.event.name}
              {meta.event.stage ? ` — ${meta.event.stage}` : ""}
              {meta.event.group ? ` — ${meta.event.group}` : ""}
              {meta.event.match_number ? ` (#${meta.event.match_number})` : ""}
            </div>
          )}
          {meta.toss && (
            <div>
              Toss: {meta.toss.winner} chose to {meta.toss.decision}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 28 }}>
        <strong>
          {score.runs}/{score.wickets}
        </strong>{" "}
        ({formatOvers(score.overs, score.balls)})
      </div>

      <div style={{ marginTop: 4 }}>
        <span>Run rate: {runRate.toFixed(2)}</span>
        {requiredRunRate != null && (
          <span style={{ marginLeft: 12 }}>
            Req. rate: {requiredRunRate.toFixed(2)}
          </span>
        )}
      </div>

      {/* Batting */}
      <div style={{ marginTop: 20 }}>
        <h3>Batting</h3>
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(batters).map(([name, b]) => {
              const sr = b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "-";
              return (
                <tr key={name}>
                  <td align="left">
                    {name} {b.out ? "" : "*"}
                  </td>
                  <td align="center">{b.runs}</td>
                  <td align="center">{b.balls}</td>
                  <td align="center">{b.fours}</td>
                  <td align="center">{b.sixes}</td>
                  <td align="center">{sr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bowling */}
      <div style={{ marginTop: 20 }}>
        <h3>Bowling</h3>
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Bowler</th>
              <th>O</th>
              <th>R</th>
              <th>W</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bowlers).map(([name, bw]) => {
              if (!bw.balls) return null;
              const overs = Math.floor(bw.balls / 6);
              const balls = bw.balls % 6;
              return (
                <tr key={name}>
                  <td align="left">{name}</td>
                  <td align="center">{formatOvers(overs, balls)}</td>
                  <td align="center">{bw.runs}</td>
                  <td align="center">{bw.wickets}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fall of wickets */}
      {fallOfWickets.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Fall of wickets</h3>
          <div style={{ fontSize: 14 }}>
            {fallOfWickets.map((f, idx) => (
              <div key={idx}>
                {idx + 1}. {f.score} ({f.player}, {f.over})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partnerships */}
      {(partnerships.length > 0 || currentPartnership.runs > 0) && (
        <div style={{ marginTop: 20 }}>
          <h3>Partnerships</h3>
          <div style={{ fontSize: 14 }}>
            {partnerships.map((p, idx) => (
              <div key={idx}>
                {p.runs} runs between {p.batters.join(" & ")}
              </div>
            ))}
            {currentPartnership.runs > 0 && (
              <div>
                {currentPartnership.runs}* runs between{" "}
                {Array.from(currentPartnership.batters).join(" & ")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manhattan */}
      {renderManhattan()}

      {/* Wagon wheel note */}
      <div style={{ marginTop: 20, fontSize: 12, color: "#aaa" }}>
        Wagon wheel requires shot direction data, which Cricsheet does not provide in this JSON.
      </div>

      {/* Commentary */}
      {commentary.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Commentary</h3>
          <div style={{ fontSize: 14 }}>
            {commentary.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
