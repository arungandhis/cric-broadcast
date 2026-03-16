import React, { useState } from "react";
import SceneRoot from "./three/SceneRoot";
import CricsheetLoader from "./ui/CricsheetLoader";
import Scoreboard from "./ui/Scoreboard";

export default function App() {
  const [matchStarted, setMatchStarted] = useState(false);

  const startMatch = async (matchJson) => {
    console.log("Sending match JSON to backend…");

    await fetch("https://cric-broadcast-backed.onrender.com/run-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchJson),
    });

    setMatchStarted(true);
  };

  return (
    <div style={{ background: "black", color: "white", padding: 20 }}>
      <h1>Cricket Broadcast Engine</h1>

      {!matchStarted && (
        <CricsheetLoader onMatchSelected={startMatch} />
      )}
{matchStarted && <Scoreboard />}


      <SceneRoot />
    </div>
  );
}
