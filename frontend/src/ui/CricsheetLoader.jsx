import React, { useState } from "react";
import JSZip from "jszip";

export default function CricsheetLoader({ onMatchSelected }) {
  const [year, setYear] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState("");

  const YEARS = Array.from({ length: 20 }, (_, i) => 2024 - i); // 2024 → 2005

  const loadZip = async (zipName) => {
    if (!year) {
      alert("Please select a year first");
      return;
    }

    const url = `https://cric-broadcast-backed.onrender.com/cricsheet/${zipName}`;
    const res = await fetch(url);
    const blob = await res.blob();

    const zip = await JSZip.loadAsync(blob);
    const list = [];

    for (const filename of Object.keys(zip.files)) {
      if (!filename.endsWith(".json")) continue;

      // Extract year from filename: "12345-2021-xyz.json"
      const match = filename.match(/-(\d{4})-/);
      const fileYear = match ? match[1] : null;

      if (fileYear !== String(year)) continue;

      const file = zip.files[filename];
      const text = await file.async("string");
      const json = JSON.parse(text);

      // Build a user-friendly title
      const info = json.info || {};
      const teams = info.teams ? info.teams.join(" vs ") : "Unknown Teams";
      const venue = info.venue || "Unknown Venue";
      const date = info.dates ? info.dates[0] : "Unknown Date";

      list.push({
        filename,
        title: `${teams} – ${venue} – ${date}`,
        data: json,
        date,
      });
    }

    // Sort newest → oldest by date
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    setMatches(list);
    setSelectedMatch("");
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

      <div style={{ marginBottom: 10 }}>
        <button onClick={() => loadZip("ipl_json.zip")}>Load IPL</button>
        <button onClick={() => loadZip("t20s_json.zip")}>Load T20I</button>
        <button onClick={() => loadZip("odis_json.zip")}>Load ODI</button>
      </div>

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
