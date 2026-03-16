import React, { useState } from "react";
import JSZip from "jszip";

export default function CricsheetLoader({ onMatchSelected }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedYear, setSelectedYear] = useState("all");

  const loadZip = async (zipName) => {
    const url = `https://cric-broadcast-backed.onrender.com/cricsheet/${zipName}`;
    const res = await fetch(url);
    const blob = await res.blob();

    const zip = await JSZip.loadAsync(blob);
    const allMatches = [];

    for (const filename of Object.keys(zip.files)) {
      if (!filename.endsWith(".json")) continue;

      const file = zip.files[filename];
      const text = await file.async("string");
      const json = JSON.parse(text);

      // Extract year from filename: "12345-2021-xyz.json"
      const yearMatch = filename.match(/-(\d{4})-/);
      const year = yearMatch ? yearMatch[1] : "unknown";

      allMatches.push({
        filename,
        year,
        data: json,
      });
    }

    // Sort newest → oldest
    allMatches.sort((a, b) => Number(b.year) - Number(a.year));

    setMatches(allMatches);
    setSelectedMatch(null);
  };

  const filteredMatches =
    selectedYear === "all"
      ? matches
      : matches.filter((m) => m.year === selectedYear);

  const uniqueYears = [
    "all",
    ...Array.from(new Set(matches.map((m) => m.year))).sort((a, b) => b - a),
  ];

  return (
    <div style={{ marginTop: 20 }}>
      <h2>Select Match</h2>

      <div style={{ marginBottom: 10 }}>
        <button onClick={() => loadZip("ipl_json.zip")}>Load IPL</button>
        <button onClick={() => loadZip("t20s_json.zip")}>Load T20I</button>
        <button onClick={() => loadZip("odis_json.zip")}>Load ODI</button>
      </div>

      {matches.length > 0 && (
        <>
          <label style={{ marginRight: 10 }}>Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ marginBottom: 10 }}
          >
            {uniqueYears.map((year) => (
              <option key={year} value={year}>
                {year === "all" ? "All Years" : year}
              </option>
            ))}
          </select>

          <br />

          <select
            value={selectedMatch || ""}
            onChange={(e) => setSelectedMatch(e.target.value)}
            style={{ marginTop: 10 }}
          >
            <option value="">-- Select Match --</option>
            {filteredMatches.map((m) => (
              <option key={m.filename} value={m.filename}>
                {m.filename}
              </option>
            ))}
          </select>

          <br />

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
