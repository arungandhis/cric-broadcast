import React, { useState, useCallback, useEffect } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

import { generateIPLCommentary } from "../engine/commentaryEngine";
import {
  formatBallLine,
  summarizeOver,
  partnershipLine,
  pressureLine,
  bowlerPressureLine,
  crowdReaction,
} from "../engine/commentaryHelpers";

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
  const wsUrl = matchId
    ? `${import.meta.env.VITE_WS_URL}/ws/match/${matchId}`
    : null;

  const { events, connected, error } = useMatchEvents(wsUrl);
  const [processedCount, setProcessedCount] = useState(0);

  const [matchInfo, setMatchInfo] = useState({
    teamA: "",
    teamB: "",
    tossWinner: "",
    tossDecision: "",
    eventName: "",
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
      striker: null,
      nonStriker: null,
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
      striker: null,
      nonStriker: null,
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
      teamA: meta.teamA || meta.teams?.[0] || "",
      teamB: meta.teamB || meta.teams?.[1] || "",
      tossWinner: meta.toss?.winner || "",
      tossDecision: meta.toss?.decision || "",
      eventName: meta.event?.name || "",
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
      const feedOver = rawEvent.over;
      const feedBall = rawEvent.ball;
      const delivery = rawEvent.event;

      setCurrentInnings(inn);

      const runsObj = delivery.runs || {};
      const totalRuns = runsObj.total || 0;
      const wicket = delivery.wickets?.length > 0;

      const inn2State = innings[2];
      const inn2OversFloat = oversToFloat(inn2State.over, inn2State.ball);
      let rrr = "-";
      let remainingRuns = null;

      if (target && maxOvers && inn2OversFloat < maxOvers) {
        remainingRuns = target - inn2State.runs;
        const remainingOvers = maxOvers - inn2OversFloat;
        if (remainingRuns > 0 && remainingOvers > 0) {
          rrr = (remainingRuns / remainingOvers).toFixed(2);
        } else if (remainingRuns <= 0) {
          rrr = "Achieved";
        }
      }

      const thisBallSymbol =
        totalRuns === 0 ? (wicket ? "W" : 0) : totalRuns;
      const overBallsNow = [...ballsThisOver, thisBallSymbol];

      const ballLine = formatBallLine(feedOver, feedBall, delivery);
      const hypeLine = generateIPLCommentary(
        {
          batter: delivery.batter,
          bowler: delivery.bowler,
          runs: totalRuns,
          wicket,
          over: feedOver,
          ball: feedBall,
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

      setBallsThisOver((prev) => {
        const updated = [...prev, thisBallSymbol];
        if (feedBall === 5) {
          const endSummary = `End of over ${feedOver}: ${summarizeOver(
            updated
          )}`;
          setCommentary((prevC) => [endSummary, ...prevC]);
          return [];
        }
        return updated;
      });

      setPartnership((prev) =>
        wicket
          ? { runs: 0, balls: 0 }
          : { runs: prev.runs + totalRuns, balls: prev.balls + 1 }
      );

      setBowlerStats((prev) => {
        const extrasObj = delivery.extras || {};
        const isLegal = !extrasObj.wides && !extrasObj.noballs;

        const prevStats = prev[currentBowler] || {
          dots: 0,
          runsInOver: 0,
        };
        let newStats = {
          dots: isLegal && totalRuns === 0 ? prevStats.dots + 1 : 0,
          runsInOver: prevStats.runsInOver + totalRuns,
        };
        if (feedBall === 5) {
          newStats = { dots: 0, runsInOver: 0 };
        }
        return { ...prev, [currentBowler]: newStats };
      });

      setInnings((prev) => {
        const curr = { ...prev[inn] };

        if (!curr.team && team) curr.team = team;

        const batterRuns = runsObj.batter || 0;
        const extrasObj = delivery.extras || {};
        const isLegal = !extrasObj.wides && !extrasObj.noballs;

        curr.extras.wides += extrasObj.wides || 0;
        curr.extras.noballs += extrasObj.noballs || 0;
        curr.extras.legbyes += extrasObj.legbyes || 0;
        curr.extras.byes += extrasObj.byes || 0;
        curr.extras.penalty += extrasObj.penalty || 0;
        curr.extras.total +=
          (extrasObj.wides || 0) +
          (extrasObj.noballs || 0) +
          (extrasObj.legbyes || 0) +
          (extrasObj.byes || 0) +
          (extrasObj.penalty || 0);

        const newRuns = curr.runs + totalRuns;
        let newWickets = curr.wickets;

        const fowOverStr = formatOvers(curr.over, curr.ball);

        if (delivery.wickets && delivery.wickets.length > 0) {
          delivery.wickets.forEach((w) => {
            newWickets += 1;
            curr.fow.push({
              score: newRuns,
              wicket: newWickets,
              player: w.player_out,
              overStr: fowOverStr,
            });
          });
        }

        const batterName = delivery.batter;
        const nonStrikerName =
          delivery.non_striker || delivery.nonStriker || null;

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
          if (isLegal) newBatter.balls += 1;
          newBatter.runs += batterRuns;

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
          if (isLegal) newBowler.balls += 1;
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

        if (isLegal) {
          if (curr.ball === 5) {
            curr.over += 1;
            curr.ball = 0;
          } else {
            curr.ball += 1;
          }
        }

        if (batterName) curr.striker = batterName;
        if (nonStrikerName) curr.nonStriker = nonStrikerName;

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

  useEffect(() => {
    if (!events || events.length === 0) return;
    for (let i = processedCount; i < events.length; i++) {
      handleBall(events[i]);
    }
    setProcessedCount(events.length);
  }, [events, processedCount, handleBall]);

  const renderBattersTable = (inn) => {
    const batters = inn.batters;
    const entries = Object.entries(batters);
    if (entries.length === 0) return null;

    return (
      <div
        style={{
          background: "#ffffff",
          padding: 16,
          borderRadius: 8,
          marginTop: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 12 }}>Batting</h3>

        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
              <th align="left">Dismissal</th>
            </tr>
          </thead>

          <tbody>
            {entries.map(([name, s]) => {
              const sr =
                s.balls > 0 ? ((s.runs * 100) / s.balls).toFixed(1) : "-";
              const isStriker = name === inn.striker;
              const isNonStriker = name === inn.nonStriker;

              return (
                <tr
                  key={name}
                  style={{
                    borderBottom: "1px solid #f2f2f2",
                    height: 32,
                  }}
                >
                  <td align="left">
                    {isStriker && <strong>*</strong>}
                    {isNonStriker && !isStriker && (
                      <span style={{ opacity: 0.6 }}>•</span>
                    )}{" "}
                    {name}
                  </td>
                  <td align="center">{s.runs}</td>
                  <td align="center">{s.balls}</td>
                  <td align="center">{s.fours}</td>
                  <td align="center">{s.sixes}</td>
                  <td align="center">{sr}</td>
                  <td align="left">
                    {s.out ? formatDismissal(s.dismissal) : "not out"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBowlersTable = (bowlers) => {
    const entries = Object.entries(bowlers);
    if (entries.length === 0) return null;

    return (
      <div
        style={{
          background: "#ffffff",
          padding: 16,
          borderRadius: 8,
          marginTop: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 12 }}>Bowling</h3>

        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
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
                <tr
                  key={name}
                  style={{
                    borderBottom: "1px solid #f2f2f2",
                    height: 32,
                  }}
                >
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
      </div>
    );
  };

  const renderFOW = (fow) => {
    if (!fow || fow.length === 0) return null;

    return (
      <div
        style={{
          background: "#ffffff",
          padding: 16,
          borderRadius: 8,
          marginTop: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          fontSize: 14,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 12 }}>Fall of Wickets</h3>

        {fow.map((w, idx) => (
          <div key={idx} style={{ marginBottom: 4 }}>
            {w.score}/{w.wicket} — {w.player} ({w.overStr})
          </div>
        ))}
      </div>
    );
  };

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

  if (!matchId) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        No match selected.
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <h2>Cricket Broadcast Engine</h2>
        <p style={{ color: "red" }}>WebSocket error: {error}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "Inter, sans-serif",
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 6 }}>
          {matchInfo.eventName || "Match"}
        </h2>

        <div style={{ fontSize: 16, opacity: 0.8 }}>
          {matchInfo.teamA} vs {matchInfo.teamB}
        </div>

        {matchInfo.tossWinner && (
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
            Toss: {matchInfo.tossWinner} won the toss and chose to{" "}
            {matchInfo.tossDecision}
          </div>
        )}

        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
          WebSocket:{" "}
          <span style={{ color: connected ? "green" : "orange" }}>
            {connected ? "Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10 }}>
          {inn1.team || "Team 1"} — {inn1.runs}/{inn1.wickets}{" "}
          ({inn1.over}.{inn1.ball}) RR: {inn1RR}
        </h2>

        {renderBattersTable(inn1)}
        {renderBowlersTable(inn1.bowlers)}
        {renderFOW(inn1.fow)}
      </div>

      <div
        style={{
          background: "#ffffff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10 }}>
          {inn2.team || "Team 2"} — {inn2.runs}/{inn2.wickets}{" "}
          ({inn2.over}.{inn2.ball}) RR: {inn2RR}
        </h2>

        {target && (
          <div style={{ marginBottom: 10, fontSize: 15 }}>
            Target: {target} | RRR: {rrr}
          </div>
        )}

        {renderBattersTable(inn2)}
        {renderBowlersTable(inn2.bowlers)}
        {renderFOW(inn2.fow)}
      </div>

      <div
        style={{
          background: "#ffffff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: 40,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 12 }}>Commentary</h2>

        <div
          style={{
            maxHeight: 400,
            overflowY: "auto",
            paddingRight: 10,
          }}
        >
          {commentary.map((line, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #f0f0f0",
                fontSize: 14,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
