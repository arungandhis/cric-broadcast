import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

export default function Scoreboard({ matchId }) {
  const [inningsData, setInningsData] = useState({
    1: { team: "", runs: 0, wickets: 0, overs: 0, balls: 0 },
    2: { team: "", runs: 0, wickets: 0, overs: 0, balls: 0 },
  });

  const [currentInnings, setCurrentInnings] = useState(1);

  const handleBall = useCallback((rawEvent) => {
    if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

    const delivery = rawEvent.event;

    // Extract team from delivery
    const battingTeam = delivery.team;

    // Detect innings change:
    // If the batting team changes → new innings
    const isNewInnings =
      inningsData[currentInnings].team &&
      inningsData[currentInnings].team !== battingTeam;

    if (isNewInnings) {
      console.log("🔄 New innings detected!");
      setCurrentInnings((prev) => prev + 1);
      return;
    }

    // Update current innings
    setInningsData((prev) => {
      const inn = currentInnings;
      const curr = { ...prev[inn] };

      // Set team name if not set
      if (!curr.team) curr.team = battingTeam;

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
  }, [currentInnings, inningsData]);

  useMatchEvents(matchId, handleBall);

  const inn1 = inningsData[1];
  const inn2 = inningsData[2];

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

      {/* CURRENT INNINGS INDICATOR */}
      <div style={{ marginTop: 10, opacity: 0.7 }}>
        Updating: Innings {currentInnings}
      </div>
    </div>
  );
}
