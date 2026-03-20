import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function createEmptyInningsState() {
  return {
    team: null,
    score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
    batters: {}, // name -> { runs, balls, fours, sixes, out }
    bowlers: {}, // name -> { balls, runs, wickets }
    fallOfWickets: [], // { score, over, player }
    partnerships: [], // completed
    currentPartnership: { runs: 0, batters: new Set() },
    manhattan: [], // runs per over
    worm: [], // cumulative runs per ball
    overSummaries: [], // { over, runs, wickets, sequence }
    timeline: [], // { over, ball, symbol }
    commentary: [], // latest first
  };
}

const formatOvers = (overs, balls) => `${overs}.${balls}`;

const isLegalBall = (event) => {
  const extras = event.extras || {};
  if (extras.wides || extras.no_balls) return false;
  return true;
};

const computeRunRate = (score) => {
  const totalBalls = score.overs * 6 + score.balls;
  if (totalBalls === 0) return 0;
  return (score.runs * 6) / totalBalls;
};

const computeProjected = (score, maxOvers) => {
  const totalBalls = score.overs * 6 + score.balls;
  if (totalBalls === 0) return null;
  const maxBalls = maxOvers * 6;
  const rr = computeRunRate(score);
  const proj = (rr * maxBalls) / 6;
  return Math.round(proj);
};

// 🔥 Rich commentary engine
const generateCommentary = (
  data,
  prevRuns,
  prevWickets,
  batterStats,
  bowlerStats,
  partnershipRuns,
  scoreAfter,
  maxOvers,
  target // { runs, overs } or null
) => {
  const { event, over, ball, team } = data;
  const batter = event.batter;
  const bowler = event.bowler;

  const runs = event.runs?.batter || 0;
  const total = event.runs?.total || 0;
  const extras = event.extras || {};
  const wicket = event.wickets && event.wickets.length > 0 ? event.wickets[0] : null;

  const newTotal = scoreAfter.runs;
  const newWkts = scoreAfter.wickets;

  // Batter stats
  const b = batterStats[batter] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const strikeRate = b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0";

  // Bowler stats
  const bw = bowlerStats[bowler] || { balls: 0, runs: 0, wickets: 0 };
  const bwOvers = Math.floor(bw.balls / 6);
  const bwBalls = bw.balls % 6;
  const economy = bw.balls ? ((bw.runs * 6) / bw.balls).toFixed(2) : "0.00";

  // Partnership
  const pRuns = partnershipRuns;

  // Run rate / pressure
  const totalBalls = scoreAfter.overs * 6 + scoreAfter.balls;
  const crr = totalBalls ? (newTotal * 6) / totalBalls : 0;
  let rrr = null;
  let runsNeeded = null;
  let ballsLeft = null;

  if (target) {
    const targetRuns = target.runs;
    const maxBalls = target.overs * 6;
    runsNeeded = targetRuns - newTotal;
    ballsLeft = maxBalls - totalBalls;
    if (runsNeeded > 0 && ballsLeft > 0) {
      rrr = (runsNeeded * 6) / ballsLeft;
    }
  }

  const fmtRR = (v) => (v == null ? "-" : v.toFixed(2));

  let lines = [];

  // Core ball description
  if (wicket) {
    const kind = wicket.kind;
    const outName = wicket.player_out;
    lines.push(
      `${over}.${ball} ${bowler} to ${batter} — OUT! ${outName} ${kind}!`,
      `${team} now ${newTotal}/${newWkts}.`
    );
  } else if (extras.wides) {
    lines.push(
      `${over}.${ball} ${bowler} bowls a wide — ${extras.wides} run(s).`,
      `Score: ${newTotal}/${newWkts}.`
    );
  } else if (extras.no_balls) {
    lines.push(
      `${over}.${ball} No-ball from ${bowler}! Free hit coming.`,
      `Score: ${newTotal}/${newWkts}.`
    );
  } else if (runs === 0 && total === 0) {
    lines.push(
      `${over}.${ball} ${bowler} to ${batter} — dot ball.`,
      `Score: ${newTotal}/${newWkts}.`
    );
  } else if (runs === 4) {
    lines.push(
      `${over}.${ball} ${bowler} to ${batter} — FOUR! Crunched to the fence.`,
      `Score: ${newTotal}/${newWkts}.`
    );
  } else if (runs === 6) {
    lines.push(
      `${over}.${ball} ${bowler} to ${batter} — SIX! That’s massive!`,
      `Score: ${newTotal}/${newWkts}.`
    );
  } else {
    lines.push(
      `${over}.${ball} ${bowler} to ${batter} — ${total} run(s).`,
      `Score: ${newTotal}/${newWkts}.`
    );
  }

  // Batter line
  lines.push(
    `${batter}: ${b.runs}(${b.balls}) with ${b.fours}×4, ${b.sixes}×6 (SR ${strikeRate}).`
  );

  // Bowler line
  lines.push(
    `${bowler}: ${bwOvers}.${bwBalls} overs, ${bw.runs} runs, ${bw.wickets} wickets (Eco ${economy}).`
  );

  // Partnership
  if (pRuns > 0) {
    lines.push(`Partnership: ${pRuns} runs.`);
  }

  // Pressure / chase context
  if (target && runsNeeded > 0 && ballsLeft > 0) {
    lines.push(
      `CRR ${fmtRR(crr)}, RRR ${fmtRR(rrr)} — ${runsNeeded} needed off ${ballsLeft} balls.`
    );
  }

  // Milestones
  if (!wicket) {
    if (b.runs >= 50 && b.runs - runs < 50) {
      lines.push(`${batter} brings up a fine fifty!`);
    }
    if (b.runs >= 100 && b.runs - runs < 100) {
      lines.push(`${batter} reaches a superb hundred!`);
    }
  }

  if (bw.wickets >= 3 && bw.wickets - (wicket ? 1 : 0) < 3) {
    lines.push(`${bowler} now has three wickets in this spell.`);
  }
  if (bw.wickets >= 5 && bw.wickets - (wicket ? 1 : 0) < 5) {
    lines.push(`${bowler} completes a five‑wicket haul!`);
  }

  // Over‑end summary (simple heuristic)
  const isOverEnd = ball === 6 || scoreAfter.balls === 0;
  if (isOverEnd) {
    lines.push(
      `End of over ${over}. ${team} ${newTotal}/${newWkts} (RR ${fmtRR(crr)}).`
    );
  }

  return lines.join("\n");
};

// 🏁 Match summary + result
const getTopBatter = (inn) => {
  const entries = Object.entries(inn.batters);
  if (!entries.length) return "No batting data";
  const sorted = entries.sort((a, b) => b[1].runs - a[1].runs);
  const [name, stats] = sorted[0];
  return `${name} ${stats.runs}(${stats.balls})`;
};

const getTopBowler = (inn1, inn2) => {
  const bowlers = [
    ...Object.entries(inn1.bowlers),
    ...Object.entries(inn2.bowlers),
  ];
  if (!bowlers.length) return "No bowling data";
  const sorted = bowlers.sort((a, b) => b[1].wickets - a[1].wickets);
  const [name, stats] = sorted[0];
  return `${name} ${stats.wickets} wickets`;
};

const generateMatchSummary = (innings) => {
  const inn1 = innings[1];
  const inn2 = innings[2];

  if (!inn1.team || inn1.score.runs === 0) return null;

  const team1 = inn1.team;
  const team2 = inn2.team || "Second team";

  const score1 = `${inn1.score.runs}/${inn1.score.wickets} (${inn1.score.overs}.${inn1.score.balls})`;
  const score2 = inn2.score.runs
    ? `${inn2.score.runs}/${inn2.score.wickets} (${inn2.score.overs}.${inn2.score.balls})`
    : null;

  let result = "";

  if (!score2) {
    result = `${team1} scored ${score1}. Second innings not played.`;
  } else {
    if (inn2.score.runs > inn1.score.runs) {
      const wicketsLeft = 10 - inn2.score.wickets;
      result = `${team2} won by ${wicketsLeft} wicket(s).`;
    } else if (inn2.score.runs < inn1.score.runs) {
      const runsShort = inn1.score.runs - inn2.score.runs;
      result = `${team1} won by ${runsShort} runs.`;
    } else {
      result = `Match tied.`;
    }
  }

  return [
    "🏁 MATCH SUMMARY",
    "",
    `${team1}: ${score1}`,
    `${team2}: ${score2 || "Did not bat"}`,
    "",
    `Result: ${result}`,
    "",
    "Top Performers:",
    `• ${team1} batting: ${getTopBatter(inn1)}`,
    `• ${team2} batting: ${getTopBatter(inn2)}`,
    `• Best bowler: ${getTopBowler(inn1, inn2)}`,
  ].join("\n");
};

export default function Scoreboard() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId");

  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("connecting");

  const [innings, setInnings] = useState({
    1: createEmptyInningsState(),
    2: createEmptyInningsState(),
  });

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
        const inn = data.inning || 1;
        const teamName = data.team;

        setInnings((prev) => {
          const next = {
            1: { ...prev[1] },
            2: { ...prev[2] },
          };
          const state = next[inn];

          // shallow copies of nested objects
          state.score = { ...state.score };
          state.batters = { ...state.batters };
          state.bowlers = { ...state.bowlers };
          state.currentPartnership = {
            ...state.currentPartnership,
            batters: new Set(state.currentPartnership.batters),
          };
          state.manhattan = [...state.manhattan];
          state.worm = [...state.worm];
          state.fallOfWickets = [...state.fallOfWickets];
          state.partnerships = [...state.partnerships];
          state.overSummaries = [...state.overSummaries];
          state.timeline = [...state.timeline];
          state.commentary = [...state.commentary];

          if (!state.team) state.team = teamName;

          const event = data.event;
          const totalRuns = event.runs?.total || 0;
          const batterName = event.batter;
          const bowlerName = event.bowler;
          const wicketArr = event.wickets || [];
          const isWicket = wicketArr.length > 0;
          const legal = isLegalBall(event);

          const prevRuns = state.score.runs;
          const prevWickets = state.score.wickets;

          // Score
          state.score.runs += totalRuns;
          if (isWicket) state.score.wickets += wicketArr.length;
          if (legal) {
            state.score.balls += 1;
            if (state.score.balls === 6) {
              state.score.overs += 1;
              state.score.balls = 0;
            }
          }

          // Batters
          if (!state.batters[batterName]) {
            state.batters[batterName] = {
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              out: false,
            };
          }
          const b = state.batters[batterName];
          const batRuns = event.runs?.batter || 0;
          b.runs += batRuns;
          if (legal) b.balls += 1;
          if (batRuns === 4) b.fours += 1;
          if (batRuns === 6) b.sixes += 1;
          if (isWicket && wicketArr[0].player_out === batterName) {
            b.out = true;
          }

          // Bowlers
          if (!state.bowlers[bowlerName]) {
            state.bowlers[bowlerName] = { balls: 0, runs: 0, wickets: 0 };
          }
          const bw = state.bowlers[bowlerName];
          bw.runs += totalRuns;
          if (legal) bw.balls += 1;
          if (isWicket) bw.wickets += wicketArr.length;

          // Fall of wickets
          if (isWicket) {
            const overStr = `${data.over}.${data.ball}`;
            const player = wicketArr[0].player_out;
            const totalAfter = prevRuns + totalRuns;
            const wicketNumber = prevWickets + 1;
            state.fallOfWickets.push({
              score: `${totalAfter}/${wicketNumber}`,
              over: overStr,
              player,
            });
          }

          // Partnerships
          state.currentPartnership.runs += totalRuns;
          state.currentPartnership.batters.add(batterName);
          if (isWicket) {
            state.partnerships.push({
              runs: state.currentPartnership.runs,
              batters: Array.from(state.currentPartnership.batters),
            });
            state.currentPartnership = {
              runs: 0,
              batters: new Set(),
            };
          }

          // Manhattan
          const overIdx = data.over;
          if (state.manhattan[overIdx] == null) state.manhattan[overIdx] = 0;
          state.manhattan[overIdx] += totalRuns;

          // Worm
          const lastCum = state.worm.length
            ? state.worm[state.worm.length - 1]
            : 0;
          state.worm.push(lastCum + totalRuns);

          // Over summaries
          if (!state.overSummaries[overIdx]) {
            state.overSummaries[overIdx] = {
              over: overIdx,
              runs: 0,
              wickets: 0,
              sequence: [],
            };
          }
          const os = state.overSummaries[overIdx];
          os.runs += totalRuns;
          if (isWicket) os.wickets += wicketArr.length;

          let seqSymbol = "";
          const extras = event.extras || {};
          if (isWicket) seqSymbol = "W";
          else if (extras.wides) seqSymbol = `${extras.wides}wd`;
          else if (extras.no_balls) seqSymbol = `${batRuns}+nb`;
          else if (batRuns === 0 && totalRuns === 0) seqSymbol = ".";
          else seqSymbol = String(totalRuns);
          os.sequence.push(seqSymbol);

          // Timeline
          let tlSymbol = "•";
          const isBoundary4 = batRuns === 4;
          const isBoundary6 = batRuns === 6;
          if (isWicket) tlSymbol = "W";
          else if (isBoundary6) tlSymbol = "6";
          else if (isBoundary4) tlSymbol = "4";
          else if (extras.wides || extras.no_balls) tlSymbol = "+";
          else if (batRuns === 0 && totalRuns === 0) tlSymbol = ".";
          else tlSymbol = String(totalRuns);

          state.timeline.push({
            over: data.over,
            ball: data.ball,
            symbol: tlSymbol,
          });

          // Commentary (per innings) with full context
          const maxOvers = meta?.event?.overs || 50;
          const target = meta?.target || null;
          const line = generateCommentary(
            data,
            prevRuns,
            prevWickets,
            state.batters,
            state.bowlers,
            state.currentPartnership.runs,
            state.score,
            maxOvers,
            target
          );
          state.commentary.unshift(line);
          if (state.commentary.length > 60) state.commentary.pop();

          return next;
        });
      } else if (data.type === "end") {
        // Match end: generate summary and inject into commentary
        const summary = generateMatchSummary(innings);
        if (summary) {
          setInnings((prev) => {
            const next = {
              1: { ...prev[1], commentary: [...prev[1].commentary] },
              2: { ...prev[2], commentary: [...prev[2].commentary] },
            };
            next[1].commentary.unshift(summary);
            next[2].commentary.unshift(summary);
            return next;
          });
        }
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
    };

    return () => ws.close();
  }, [matchId, meta, innings]);

  const maxOvers = meta?.event?.overs || 50;

  const renderManhattan = (state) => {
    const arr = state.manhattan;
    if (!arr.length) return null;
    const filtered = arr.filter((v) => v != null);
    if (!filtered.length) return null;
    const max = Math.max(...filtered);
    if (!max) return null;

    return (
      <div style={{ marginTop: 10 }}>
        <div>Manhattan (runs per over)</div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          {arr.map((runs, i) => {
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

  const renderWorm = (state) => {
    const arr = state.worm;
    if (!arr.length) return null;
    const max = Math.max(...arr);
    if (!max) return null;

    return (
      <div style={{ marginTop: 10 }}>
        <div>Worm (cumulative runs)</div>
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
          {arr.map((val, i) => {
            const height = (val / max) * 60;
            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 4,
                    height,
                    background: "#ff9800",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOverSummaries = (state) => {
    const arr = state.overSummaries;
    if (!arr.length) return null;
    return (
      <div style={{ marginTop: 20 }}>
        <h4>Over summaries</h4>
        <div style={{ fontSize: 14 }}>
          {arr.map((os, idx) => {
            if (!os) return null;
            return (
              <div key={idx}>
                Over {os.over}: {os.runs} runs, {os.wickets} wkts —{" "}
                {os.sequence.join(" ")}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeline = (state) => {
    const arr = state.timeline;
    if (!arr.length) return null;
    return (
      <div style={{ marginTop: 20 }}>
        <h4>Timeline</h4>
        <div style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {arr.map((t, idx) => (
            <span key={idx}>
              {t.over}.{t.ball}:{t.symbol}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderInningsBlock = (innNumber) => {
    const state = innings[innNumber];
    const score = state.score;
    const rr = computeRunRate(score);
    const proj = computeProjected(score, maxOvers);

    const hasData =
      score.runs > 0 ||
      score.wickets > 0 ||
      Object.keys(state.batters).length > 0 ||
      Object.keys(state.bowlers).length > 0;

    if (!hasData) return null;

    return (
      <div
        key={innNumber}
        style={{
          marginTop: 30,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #444",
          background: "#111",
        }}
      >
        <h3>
          Innings {innNumber}: {state.team || "Unknown team"}
        </h3>

        <div style={{ marginTop: 10, fontSize: 24 }}>
          <strong>
            {score.runs}/{score.wickets}
          </strong>{" "}
          ({formatOvers(score.overs, score.balls)})
        </div>

        <div style={{ marginTop: 4 }}>
          <span>Run rate: {rr.toFixed(2)}</span>
          {proj != null && (
            <span style={{ marginLeft: 12 }}>Proj: {proj}</span>
          )}
        </div>

        {/* Batting */}
        <div style={{ marginTop: 16 }}>
          <h4>Batting</h4>
          <table
            style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}
          >
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
              {Object.entries(state.batters).map(([name, b]) => {
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
        <div style={{ marginTop: 16 }}>
          <h4>Bowling</h4>
          <table
            style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th align="left">Bowler</th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(state.bowlers).map(([name, bw]) => {
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
        {state.fallOfWickets.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>Fall of wickets</h4>
            <div style={{ fontSize: 14 }}>
              {state.fallOfWickets.map((f, idx) => (
                <div key={idx}>
                  {idx + 1}. {f.score} ({f.player}, {f.over})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partnerships */}
        {(state.partnerships.length > 0 ||
          state.currentPartnership.runs > 0) && (
          <div style={{ marginTop: 16 }}>
            <h4>Partnerships</h4>
            <div style={{ fontSize: 14 }}>
              {state.partnerships.map((p, idx) => (
                <div key={idx}>
                  {p.runs} runs between {p.batters.join(" & ")}
                </div>
              ))}
              {state.currentPartnership.runs > 0 && (
                <div>
                  {state.currentPartnership.runs}* runs between{" "}
                  {Array.from(state.currentPartnership.batters).join(" & ")}
                </div>
              )}
            </div>
          </div>
        )}

        {renderManhattan(state)}
        {renderWorm(state)}
        {renderOverSummaries(state)}
        {renderTimeline(state)}

        {/* Commentary for this innings */}
        {state.commentary.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>Commentary</h4>
            <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>
              {state.commentary.map((line, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const matchSummary = generateMatchSummary(innings);

  return (
    <div style={{ padding: 20, color: "white", fontFamily: "system-ui" }}>
      <h2>Cricket Broadcast Engine</h2>

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

      {renderInningsBlock(1)}
      {renderInningsBlock(2)}

      {/* Match Result block */}
      {matchSummary && (
        <div
          style={{
            marginTop: 30,
            padding: 16,
            borderRadius: 8,
            border: "1px solid #555",
            background: "#222",
            whiteSpace: "pre-line",
          }}
        >
          <h3>Match Result</h3>
          {matchSummary}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 12, color: "#aaa" }}>
        Wagon wheel would require shot direction/angle data, which is not present in Cricsheet JSON.
      </div>
    </div>
  );
}
