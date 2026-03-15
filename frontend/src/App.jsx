import React, { useState } from "react";
import SceneRoot from "./three/SceneRoot";

export default function App() {
  const [matchStarted, setMatchStarted] = useState(false);

  const startMatch = async () => {
    try {
      console.log("Calling /run-match...");
      const res = await fetch("https://cric-broadcast-backed.onrender.com/run-match", {
        method: "POST",
      });
      console.log("Response:", res.status);
      setMatchStarted(true);
    } catch (err) {
      console.error("Error starting match:", err);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "black",
        overflow: "hidden",
        color: "white",
        padding: 20,
      }}
    >
      <h1>Cricket Broadcast</h1>

      {!matchStarted && (
        <button
          onClick={startMatch}
          style={{
            padding: "12px 20px",
            fontSize: "18px",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          Start Match
        </button>
      )}

      <SceneRoot />
    </div>
  );
}
