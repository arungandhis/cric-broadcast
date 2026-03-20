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

          // Commentary (per innings)
          const line = generateCommentary(data, prevRuns, prevWickets);
          state.commentary.unshift(line);
          if (state.commentary.length > 40) state.commentary.pop();

          return next;
        });
      } else if (data.type === "end") {
        // nothing special needed here for now
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
    };

    return () => ws.close();
  }, [matchId]);

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
            <div style={{ fontSize: 14 }}>
              {state.commentary.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

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

      {/* Innings 1 and 2 stacked */}
      {renderInningsBlock(1)}
      {renderInningsBlock(2)}

      <div style={{ marginTop: 20, fontSize: 12, color: "#aaa" }}>
        Wagon wheel would require shot direction/angle data, which is not present in Cricsheet JSON.
      </div>
    </div>
  );
}
