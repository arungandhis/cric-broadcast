import React, { useState } from "react";
import SceneRoot from "./three/SceneRoot";
import CricsheetLoader from "./ui/CricsheetLoader";
import Scoreboard from "./ui/Scoreboard";

export default function App() {
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchId, setMatchId] = useState(null);

  const startMatch = async (matchJson) => {
    // Create a unique matchId for this session/tab
    const id = crypto.randomUUID();
    setMatchId(id);

    console.log("Sending match JSON to backend for matchId:", id);

    await fetch(
      `https://cric-broadcast-backed.onrender.com/run-match/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchJson),
      }
    );

    setMatchStarted(true);
  };

  return (
    <div style={{ background: "black", color: "white", padding: 20 }}>
      <h1>Cricket Broadcast Engine</h1>

      {!matchStarted && (
        <CricsheetLoader onMatchSelected={startMatch} />
      )}

      {matchStarted && <Scoreboard matchId={matchId} />}

      <SceneRoot matchId={matchId} />
    </div>
  );
}
