import React from "react";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useEffect } from "react";


import CricsheetLoader from "./ui/CricsheetLoader.jsx";
import Scoreboard from "./ui/Scoreboard.jsx";
import SceneRoot from "./three/SceneRoot.jsx";

// Wrapper so Scoreboard + SceneRoot both receive matchId from URL
function ScoreboardPage() {
  const [params] = useSearchParams();
  const matchId = params.get("matchId");

  return (
    <div style={{ background: "black", color: "white", padding: 20 }}>
      <h1>Cricket Broadcast Engine</h1>

      <Scoreboard matchId={matchId} />
      <SceneRoot matchId={matchId} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home → Match Selector */}
        <Route
          path="/"
          element={
            <div style={{ background: "black", color: "white", padding: 20 }}>
              <h1>Cricket Broadcast Engine</h1>
              <CricsheetLoader />
            </div>
          }
        />

        {/* Scoreboard Page */}
        <Route path="/scoreboard" element={<ScoreboardPage />} />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <div style={{ padding: 20, color: "white" }}>
              Page not found.
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
