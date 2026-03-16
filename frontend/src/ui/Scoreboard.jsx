import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

export default function Scoreboard({ matchId }) {
  const [score, setScore] = useState({
    innings: 1,
    runs: 0,
    wickets: 0,
    overs: 0,
    ballsInOver: 0,
    striker: "",
    nonStriker: "",
    bowler: "",
    lastRuns: 0,
    battingTeam: "",
  });

  const handleBall = useCallback((rawEvent) => {
    if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

    const delivery = rawEvent.event;
    const runs = delivery.runs?.total ?? 0;
    const wicket = delivery.wickets ? delivery.wickets.length : 0;

    const batter = delivery.batter;
    const bowler = delivery.bowler;

    // Detect innings change:
    // If overs reset OR new batter team appears
    const isNewInnings =
      (score.overs === 0 && score.ballsInOver === 0 && score.runs === 0) === false &&
      delivery.over === 0 &&
      delivery.ball === 1;

    setScore((prev) => {
      let newInnings = prev.innings;
      let newRuns = prev.runs;
      newRuns += runs;

      let newWickets = prev.wickets + wicket;

      let newBalls = prev.ballsInOver + 1;
      let newOvers = prev.overs;

      if (newBalls === 6) {
        newOvers += 1;
        newBalls = 0;
      }

      // If innings changed → reset everything
      if (isNewInnings) {
        return {
          innings: prev.innings + 1,
          runs: runs,
          wickets: wicket,
          overs: 0,
          ballsInOver: 0,
          striker: batter,
          nonStriker: delivery.non_striker,
          bowler: bowler,
          lastRuns: runs,
          battingTeam: delivery.team || prev.battingTeam,
        };
      }

      return {
        innings: newInnings,
        runs: newRuns,
        wickets: newWickets,
        overs: newOvers,
        ballsInOver: newBalls,
        striker: batter ?? prev.striker,
        nonStriker: delivery.non_striker ?? prev.nonStriker,
        bowler: bowler ?? prev.bowler,
        lastRuns: runs,
        battingTeam: delivery.team || prev.battingTeam,
      };
    });
  }, [score]);

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
      <h2 style={{ marginBottom: 10 }}>
        Innings {score.innings} – {score.battingTeam}
      </h2>

      <div style={{ fontSize: 24, marginBottom: 10 }}>
        {score.runs}/{score.wickets} ({score.overs}.{score.ballsInOver})
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
