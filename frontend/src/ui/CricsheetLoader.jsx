import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCricsheetIndex } from "../hooks/useCricsheetIndex.jsx";

export default function CricsheetLoader() {
  const navigate = useNavigate();
  const { index, loading } = useCricsheetIndex();

  const [format, setFormat] = useState("");
  const [selectedMatch, setSelectedMatch] = useState("");
  const [matchJson, setMatchJson] = useState(null);
  const [matchTitles, setMatchTitles] = useState({});
  const [debug, setDebug] = useState("");

  if (loading) {
    return <div style={{ padding: 20, color: "white" }}>Loading Cricsheet index…</div>;
  }

  if (!index) {
    return <div style={{ padding: 20, color: "white" }}>Failed to load Cricsheet index.</div>;
  }

  // Ensure index is an array
  let list = [];
  if (Array.isArray(index)) {
    list = index;
  } else if (typeof index === "object") {
    list = Object.values(index).flat();
  }

  // Derive formats
  const formats = [];
  list.forEach((entry) => {
    const [fmt] = String(entry).split("/");
    if (fmt && !formats.includes(fmt)) formats.push(fmt);
  });

  // Matches for selected format
  const matches = list.filter((entry) => String(entry).startsWith(`${format}/`));

  async function loadMatchJson(filePath) {
    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/cricsheet/${filePath}`;
      setDebug(`Fetching: ${url}`);

      const res = await fetch(url);
      const json = await res.json();

      setMatchJson(json);

      const info = json.info || {};
      const teams = Array.isArray(info.teams) ? info.teams.join(" vs ") : "Unknown Teams";
      const date = Array.isArray(info.dates) ? info.dates[0] : "Unknown Date";
      const venue = info.venue || "Unknown Venue";

      const title = `${teams} — ${date} — ${venue}`;

      setMatchTitles((prev) => ({ ...prev, [filePath]: title }));
    } catch (err) {
      setDebug("Error loading match: " + err.message);
      setMatchJson(null);
    }
  }

  async function startMatch() {
    if (!selectedMatch || !matchJson) return;

    const matchId = crypto.randomUUID();

    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/run-match/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchJson),
      });

      navigate(`/scoreboard?matchId=${matchId}`);
    } catch (err) {
      setDebug("Error starting match: " + err.message);
    }
  }

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h2>Cricket Broadcast Engine</h2>

      {/* FORMAT SELECTOR */}
      <div style={{ marginTop: 20 }}>
        <label>Format: </label>
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setSelectedMatch("");
            setMatchJson(null);
          }}
        >
          <option value="">Select Format</option>
          {formats.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* MATCH SELECTOR */}
      {format && matches.length > 0 && (
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
            {matches.map((filePath) => (
              <option key={filePath} value={filePath}>
                {matchTitles[filePath] || filePath}
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

      {/* DEBUG OUTPUT (visible on phone) */}
      {debug && (
        <pre style={{ marginTop: 20, color: "yellow", whiteSpace: "pre-wrap" }}>
          {debug}
        </pre>
      )}
    </div>
  );
}
