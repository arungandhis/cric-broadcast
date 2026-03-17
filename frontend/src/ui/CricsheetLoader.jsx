import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// IMPORTANT: Linux/Render requires exact filename + extension
import { useCricsheetIndex } from "../hooks/useCricsheetIndex.jsx";

export default function CricsheetLoader() {
  const navigate = useNavigate();
  const { index, loading } = useCricsheetIndex();

  const [year, setYear] = useState("");
  const [format, setFormat] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [matchJson, setMatchJson] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        Loading Cricsheet index…
      </div>
    );
  }

  if (!index) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        Failed to load Cricsheet index.
      </div>
    );
  }

  // Load matches for selected year + format
  function loadMatchesFor(year, format) {
    if (!index[year] || !index[year][format]) {
      setMatches([]);
      return;
    }
    setMatches(index[year][format]);
  }

  // Load JSON for selected match
  async function loadMatchJson(fileName) {
    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/cricsheet/${fileName}`;
      const res = await fetch(url);
      const json = await res.json();
      setMatchJson(json);
    } catch (err) {
      console.error("Failed to load match JSON:", err);
    }
  }

  // Start match on backend → navigate to scoreboard
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
      console.error("Failed to start match:", err);
    }
  }

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h2>Cricket Broadcast Engine</h2>

      {/* YEAR SELECTOR */}
      <div style={{ marginTop: 20 }}>
        <label>Year: </label>
        <select
          value={year}
          onChange={(e) => {
            const y = e.target.value;
            setYear(y);
            setFormat("");
            setSelectedMatch("");
            setMatchJson(null);
            setMatches([]);
          }}
        >
          <option value="">Select Year</option>
          {Object.keys(index).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* FORMAT SELECTOR */}
      {year && (
        <div style={{ marginTop: 20 }}>
          <label>Format: </label>
          <select
            value={format}
            onChange={(e) => {
              const f = e.target.value;
              setFormat(f);
              setSelectedMatch("");
              setMatchJson(null);
              loadMatchesFor(year, f);
            }}
          >
            <option value="">Select Format</option>
            {Object.keys(index[year] || {}).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* MATCH SELECTOR */}
      {format && matches.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <label>Match: </label>
          <select
            value={selectedMatch}
            onChange={(e) => {
              const file = e.target.value;
              setSelectedMatch(file);
              loadMatchJson(file);
            }}
          >
            <option value="">Select Match</option>
            {matches.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </div>
      )}

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
    </div>
  );
}
