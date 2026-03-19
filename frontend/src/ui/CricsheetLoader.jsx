import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCricsheetIndex } from "../hooks/useCricsheetIndex.jsx";

export default function CricsheetLoader() {
  const navigate = useNavigate();
  const { index, loading } = useCricsheetIndex();

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedMatch, setSelectedMatch] = useState("");
  const [matchJson, setMatchJson] = useState(null);
  const [debug, setDebug] = useState("");

  if (loading) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        Loading ICC World Cup index…
      </div>
    );
  }

  // 🔥 DEBUG BLOCK — SHOW EXACT JSON RECEIVED FROM BACKEND
  return (
    <div style={{ padding: 20, color: "white" }}>
      <h2>DEBUG: Raw index.json from backend</h2>

      <pre style={{ color: "yellow", whiteSpace: "pre-wrap", fontSize: 12 }}>
        {JSON.stringify(index, null, 2)}
      </pre>

      {/* If index is missing world_cup, show error */}
      {(!index || !index.world_cup) && (
        <div style={{ marginTop: 20, color: "red" }}>
          Failed to load World Cup index.
        </div>
      )}

      {/* If world_cup exists, show the real UI */}
      {index && index.world_cup && (
        <>
          <h2 style={{ marginTop: 40 }}>ICC Men's Cricket World Cup</h2>

          {/* YEAR SELECTOR */}
          <div style={{ marginTop: 20 }}>
            <label>Year: </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setSelectedTeam("");
                setSelectedMatch("");
                setMatchJson(null);
              }}
            >
              <option value="">All Years</option>
              {[...new Set(index.world_cup.map((m) => m.year))]
                .sort((a, b) => b - a)
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </div>

          {/* TEAM SELECTOR */}
          <div style={{ marginTop: 20 }}>
            <label>Team: </label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setSelectedMatch("");
                setMatchJson(null);
              }}
            >
              <option value="">All Teams</option>
              {[...new Set(index.world_cup.flatMap((m) => m.teams))]
                .sort()
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>

          {/* MATCH SELECTOR */}
          <div style={{ marginTop: 20 }}>
            <label>Match: </label>
            <select
              value={selectedMatch}
              onChange={(e) => {
                const filePath = e.target.value;
                setSelectedMatch(filePath);
                loadMatchJson(filePath);
              }}
            >
              <option value="">Select Match</option>

              {index.world_cup
                .filter((m) => !selectedYear || m.year === selectedYear)
                .filter((m) => !selectedTeam || m.teams.includes(selectedTeam))
                .sort((a, b) => b.year - a.year)
                .map((m) => (
                  <option key={m.file} value={m.file}>
                    {m.teams.join(" vs ")} — {m.year}
                  </option>
                ))}
            </select>
          </div>

          {/* START MATCH BUTTON */}
          <button
            onClick={startMatch}
            disabled={!matchJson}
            style={{
              marginTop: 30,
              padding: "10px 20px",
              fontSize: 16,
              cursor: matchJson ? "pointer" : "not-allowed",
            }}
          >
            Start Match
          </button>

          {/* DEBUG OUTPUT */}
          {debug && (
            <pre
              style={{
                marginTop: 20,
                color: "yellow",
                whiteSpace: "pre-wrap",
              }}
            >
              {debug}
            </pre>
          )}
        </>
      )}
    </div>
  );

  // -----------------------------
  // FUNCTIONS
  // -----------------------------

  async function loadMatchJson(filePath) {
    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/cricsheet/${filePath}`;
      setDebug(`Fetching: ${url}`);

      const res = await fetch(url);
      const json = await res.json();

      setMatchJson(json);
    } catch (err) {
      setDebug("Error loading match: " + err.message);
      setMatchJson(null);
    }
  }

  async function startMatch() {
    if (!selectedMatch || !matchJson) return;

    const matchId = crypto.randomUUID();

    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/run-match/${matchId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matchJson),
        }
      );

      navigate(`/scoreboard?matchId=${matchId}`);
    } catch (err) {
      setDebug("Error starting match: " + err.message);
    }
  }
}
