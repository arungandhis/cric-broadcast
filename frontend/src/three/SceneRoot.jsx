
import React, { useState, useCallback } from "react";
import { useMatchEvents } from "./useMatchEvents";

export default function SceneRoot() {
  const [lastBall, setLastBall] = useState(null);

  const handleBall = useCallback((rawEvent) => {
    console.log("Raw event received:", rawEvent);

    if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

    // In your backend, `event` IS the delivery object:
    // {
    //   batter: "...",
    //   bowler: "...",
    //   runs: { total: 1, ... },
    //   ...
    // }
    const delivery = rawEvent.event;

    if (!delivery.runs || typeof delivery.runs.total !== "number") {
      return;
    }

    const parsed = {
      ball: rawEvent.ball_number,
      batter: delivery.batter,
      bowler: delivery.bowler,
      runs: delivery.runs.total,
    };

    console.log("Parsed event:", parsed);
    setLastBall(parsed);
  }, []);

  useMatchEvents(handleBall);

  return (
    <div style={{ color: "white", padding: 20 }}>
      <h2>Match Animation Debug</h2>

      {lastBall ? (
        <div>
          <p>Ball: {lastBall.ball}</p>
          <p>Batter: {lastBall.batter}</p>
          <p>Bowler: {lastBall.bowler}</p>
          <p>Runs: {lastBall.runs}</p>
        </div>
      ) : (
        <p>Waiting for match events…</p>
      )}
    </div>
  );
}
