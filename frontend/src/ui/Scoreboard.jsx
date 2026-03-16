import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

export default function Scoreboard({ matchId }) {
  const [score, setScore] = useState({
    runs: 0,
    wickets: 0,
    overs: 0,
    ballsInOver: 0,
    striker: "",
    nonStriker: "",
    bowler: "",
    lastRuns: 0,
  });

  const handleBall = useCallback((rawEvent) => {
    if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

    const delivery = rawEvent.event;
    const runs = delivery.runs?.total ?? 0;
    const wicket = delivery.wickets ? delivery.wickets.length : 0;

    setScore((prev) => {
      let newBalls = prev.ballsInOver + 1;
      let newOvers = prev.overs;

      if (newBalls === 6) {
        newOvers += 1;
        newBalls = 0;
      }

      return {
        runs: prev.runs + runs,
        wickets: prev.wickets + wicket,
        overs: newOvers,
        ballsInOver: newBalls,
        striker: delivery.batter ?? prev.striker,
        nonStriker: delivery.non_striker ?? prev.nonStriker,
        bowler: delivery.bowler ?? prev.bowler,
        lastRuns: runs,
      };
    });
  }, []);

  useMatchEvents(matchId, handleBall);

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
      <h2 style={{ marginBottom: 10 }}>Live Scoreboard</h2>

      <div style={{ fontSize: 24, marginBottom: 10 }}>
        {score.runs}/{score.wickets} &nbsp;
        ({score.overs}.{score.ballsInOver})
      </div>

      <div style={{ marginBottom: 6 }}>
        <strong>Striker:</strong> {score.striker}
      </div>
      <div style={{ marginBottom: 6 }}>
        <strong>Non‑Striker:</strong> {score.nonStriker}
      </div>
      <div style={{ marginBottom: 6 }}>
        <strong>Bowler:</strong> {score.bowler}
      </div>

      <div style={{ marginTop: 10, fontSize: 18 }}>
        <strong>Last Ball:</strong> {score.lastRuns} run(s)
      </div>
    </div>
  );
}
