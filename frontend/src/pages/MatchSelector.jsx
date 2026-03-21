import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MatchSelector.css";

export default function MatchSelector() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const navigate = useNavigate();

  const backend = import.meta.env.VITE_BACKEND_URL || "";

  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch(`${backend}/cricsheet/index.json`);
        if (!res.ok) throw new Error("Failed to load index");
        const json = await res.json();
        setMatches(json.world_cup || []);
      } catch (err) {
        console.error("Failed to load cricsheet index", err);
      } finally {
        setLoading(false);
      }
    }
    loadIndex();
  }, [backend]);

  async function handleFileUpload(e) {
    setUploadError("");
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!json.innings) {
        setUploadError("Invalid Cricsheet JSON: missing innings");
        return;
      }

      const res = await fetch(`${backend}/run-match/uploaded`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Backend rejected match upload");
      }

      // navigate to scoreboard page (adjust route if your app uses a different path)
      navigate("/scoreboard");
    } catch (err) {
      console.error(err);
      setUploadError("Invalid JSON file or upload failed");
    }
  }

  return (
    <div className="ms-root">
      <h2 className="ms-title">Cricket Broadcast Engine</h2>

      <div className="ms-upload-box">
        <p className="ms-upload-title">Upload Match JSON</p>

        <label className="ms-upload-btn">
          Select JSON File
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>

        {uploadError && <p className="ms-error">{uploadError}</p>}
      </div>

      <hr className="ms-divider" />

      <h3 className="ms-subtitle">World Cup Matches</h3>

      {loading ? (
        <p className="ms-loading">Loading matches…</p>
      ) : (
        <div className="ms-list">
          {matches.length === 0 && <div className="ms-empty">No matches found</div>}
          {matches.map((m, idx) => (
            <button
              key={idx}
              className="ms-item"
              onClick={async () => {
                // fetch the match JSON from backend and start it
                try {
                  // backend endpoint returns the match JSON; we POST it to run-match to start simulation
                  const matchRes = await fetch(`${backend}/cricsheet/odis/${m.file}`);
                  if (!matchRes.ok) throw new Error("Failed to fetch match JSON");
                  const matchJson = await matchRes.json();

                  const runRes = await fetch(`${backend}/run-match/${encodeURIComponent(m.file)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(matchJson),
                  });

                  if (!runRes.ok) throw new Error("Failed to start match");

                  navigate("/scoreboard");
                } catch (err) {
                  console.error(err);
                  setUploadError("Failed to load selected match");
                }
              }}
            >
              <div className="ms-item-teams">
                {m.teams?.[0] || "Team A"} vs {m.teams?.[1] || "Team B"}
              </div>
              <div className="ms-item-year">{m.year || "—"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
