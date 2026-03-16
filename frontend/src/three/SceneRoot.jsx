import React, { useState, useCallback } from "react";
import { useMatchEvents } from "./useMatchEvents";

export default function SceneRoot() {
  const [lastBall, setLastBall] = useState(null);

  const handleBall = useCallback((rawEvent) => {
    console.log("Raw event received:", rawEvent);

    if (!rawEvent || !rawEvent.event) return;

    const keys = Object.keys(rawEvent.event);
    if (keys.length === 0) return;

    const ballKey = keys[0];
    const delivery = rawEvent.event[ballKey];

    if (!delivery || !delivery.runs) return;

    const parsed = {
      ball: ballKey,
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
