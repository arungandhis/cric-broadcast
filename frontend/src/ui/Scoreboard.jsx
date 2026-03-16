import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

export default function Scoreboard({ matchId }) {
  const [innings, setInnings] = useState({
    1: { team: "", runs: 0, wickets: 0, overs: 0, balls: 0 },
    2: { team: "", runs: 0, wickets: 0, overs: 0, balls: 0 },
  });

  const [currentInnings, setCurrentInnings] = useState(1);

  const handleBall = useCallback((rawEvent) => {
    if (!rawEvent || rawEvent.type !== "ball") return;

    const inn = rawEvent.inning;
    const delivery = rawEvent.event;

    setCurrentInnings(inn);

    setInnings((prev) => {
      const curr = { ...prev[inn] };

      // Set team name once
      if (!curr.team && delivery.batter) {
        curr.team = delivery.batter_team || "Team " + inn;
      }

      // Add runs
      curr.runs += delivery.runs?.total ?? 0;

      // Add wickets
      curr.wickets += delivery.wickets ? delivery.wickets.length : 0;

      // Update overs/balls
      curr.balls += 1;
      if (curr.balls === 6) {
        curr.overs += 1;
        curr.balls = 0;
      }

      return {
        ...prev,
        [inn]: curr,
      };
    });
  }, []);

  useMatchEvents(matchId, handleBall);

  const inn1 = innings[1];
  const inn2 = innings[2];

  return (
    <div style={{
      background: "#111",
      padding: 20,
      borderRadius: 10,
      color: "white",
      marginTop: 20,
      fontFamily: "sans-serif"
    }}>
      <h2>Scoreboard</h2>

      {/* INNINGS 1 */}
      {inn1.team && (
        <div style={{ marginBottom: 20 }}>
          <h3>Innings 1 — {inn1.team}</h3>
          <div style={{ fontSize: 22 }}>
            {inn1.runs}/{inn1.wickets} ({inn1.overs}.{inn1.balls})
          </div>
        </div>
      )}

      {/* INNINGS 2 */}
      {inn2.team && (
        <div style={{ marginBottom: 20 }}>
          <h3>Innings 2 — {inn2.team}</h3>
          <div style={{ fontSize: 22 }}>
            {inn2.runs}/{inn2.wickets} ({inn2.overs}.{inn2.balls})
          </div>
        </div>
      )}

      <div style={{ opacity: 0.7 }}>
        Updating: Innings {currentInnings}
      </div>
    </div>
  );
}
