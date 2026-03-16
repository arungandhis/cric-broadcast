import React, { useState } from "react";
import JSZip from "jszip";

export default function CricsheetLoader({ onMatchSelected }) {
  const [year, setYear] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [status, setStatus] = useState("");

  // Generate years dynamically up to current year + 1
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: currentYear - 2004 + 2 }, (_, i) => currentYear + 1 - i);
  // Example: if currentYear = 2026 → [2027, 2026, 2025, ..., 2005]

  const loadZip = async (zipName) => {
    if (!year) {
      alert("Please select a year first");
      return;
    }

    setStatus("Loading matches...");
    setMatches([]);
    setSelectedMatch("");

    try {
      const url = `https://cric-broadcast-backed.onrender.com/cricsheet/${zipName}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const zip = await JSZip.loadAsync(blob);

      const list = [];

      for (const filename of Object.keys(zip.files)) {
        if (!filename.endsWith(".json")) continue;

        const file = zip.files[filename];
        const text = await file.async("string");
        const json = JSON.parse(text);

        const info = json.info || {};
        const dateStr = info.dates?.[0]; // <-- REAL YEAR SOURCE

        if (!dateStr) continue;

        const fileYear = dateStr.slice(0, 4);
        if (fileYear !== String(year)) continue;

        const teams = info.teams?.join(" vs ") || "Unknown Teams";
        const venue = info.venue || "Unknown Venue";

        list.push({
          filename,
          title: `${teams} – ${venue} – ${dateStr}`,
          data: json,
          date: dateStr,
        });
      }

      // Sort newest → oldest
      list.sort((a, b) => new Date(b.date) - new Date(a.date));

      setMatches(list);

      if (list.length === 0) {
        setStatus(`No matches found for ${year} in this format.`);
      } else {
        setStatus(`Loaded ${list.length} matches for ${year}.`);
      }
    } catch (err) {
      console.error("Error loading zip:", err);
      setStatus("Failed to load matches. Check network/backend.");
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h2>Select Match</h2>

      {/* YEAR FIRST */}
      <label style={{ marginRight: 10 }}>Year:</label>
      <select
        value={year}
        onChange={(e) => setYear(e.target.value)}
        style={{ marginBottom: 20 }}
      >
        <option value="">-- Select Year --</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* FORMAT BUTTONS */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => loadZip("ipl_json.zip")}>Load IPL</button>
        <button onClick={() => loadZip("t20s_json.zip")}>Load T20I</button>
        <button onClick={() => loadZip("odis_json.zip")}>Load ODI</button>
      </div>

      {status && <p style={{ marginBottom: 10 }}>{status}</p>}

      {/* MATCH DROPDOWN */}
      {matches.length > 0 && (
        <>
          <select
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="">-- Select Match --</option>
            {matches.map((m) => (
              <option key={m.filename} value={m.filename}>
                {m.title}
              </option>
            ))}
          </select>

          <button
            disabled={!selectedMatch}
            onClick={() => {
              const match = matches.find((m) => m.filename === selectedMatch);
              onMatchSelected(match.data);
            }}
            style={{ marginTop: 10 }}
          >
            Start Match
          </button>
        </>
      )}
    </div>
  );
}
