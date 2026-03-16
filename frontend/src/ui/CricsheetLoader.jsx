import React, { useState } from "react";
import JSZip from "jszip";

export default function CricsheetLoader({ onMatchSelected }) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);

  const loadZip = async (url) => {
    setLoading(true);
    setMatches([]);

    try {
      console.log("Fetching ZIP:", url);
      const res = await fetch(url);
      const blob = await res.blob();

      const zip = await JSZip.loadAsync(blob);

      const matchList = [];

      for (const filename of Object.keys(zip.files)) {
        if (!filename.endsWith(".json")) continue;

        const file = zip.files[filename];
        const text = await file.async("string");
        const json = JSON.parse(text);

        const info = json.info || {};
        const title = `${info.teams?.join(" vs ")} — ${info.dates?.[0]}`;

        matchList.push({
          filename,
          json,
          title,
        });
      }

      console.log("Loaded matches:", matchList.length);
      setMatches(matchList);
    } catch (err) {
      console.error("Error loading Cricsheet ZIP:", err);
    }

    setLoading(false);
  };

  return (
    <div style={{ color: "white", marginBottom: 20 }}>
      <h2>Select Match</h2>

      <button
        onClick={() =>
          loadZip("https://cric-broadcast-backed.onrender.com/cricsheet/ipl_json.zip")
        }
        style={{ padding: 10, marginRight: 10 }}
      >
        Load IPL
      </button>

      <button
        onClick={() =>
          loadZip("https://cric-broadcast-backed.onrender.com/cricsheet/t20s_json.zip")
        }
        style={{ padding: 10, marginRight: 10 }}
      >
        Load T20I
      </button>

      <button
        onClick={() =>
          loadZip("https://cric-broadcast-backed.onrender.com/cricsheet/odis_json.zip")
        }
        style={{ padding: 10, marginRight: 10 }}
      >
        Load ODI
      </button>

      {loading && <p>Loading matches…</p>}

      {!loading && matches.length > 0 && (
        <>
          <select
            value={selected || ""}
            onChange={(e) => setSelected(e.target.value)}
            style={{ marginTop: 20, width: "300px" }}
          >
            <option value="">-- Select Match --</option>
            {matches.map((m, i) => (
              <option key={i} value={i}>
                {m.title}
              </option>
            ))}
          </select>

          <button
            disabled={selected === null}
            onClick={() => onMatchSelected(matches[selected].json)}
            style={{ marginLeft: 10, padding: 10 }}
          >
            Start Match
          </button>
        </>
      )}
    </div>
  );
}
