import React, { useState } from "react";

import { useCricsheetIndex } from "../hooks/useCricsheetIndex.jsx";


import EventSelector from "./EventSelector";
import YearSelector from "./YearSelector";
import FormatSelector from "./FormatSelector";
import MatchSelector from "./MatchSelector";
import { useNavigate } from "react-router-dom";

export default function CricsheetLoader() {
  const { index, loading } = useCricsheetIndex();
  const navigate = useNavigate();

  const [event, setEvent] = useState("");
  const [year, setYear] = useState("");
  const [format, setFormat] = useState("");
  const [matchFile, setMatchFile] = useState("");
  const [matchJson, setMatchJson] = useState(null);

  if (loading) return <div>Loading Cricsheet Index…</div>;
  if (!index) return <div>Error loading index</div>;

  async function loadMatchJson(fileName) {
    const url = `${import.meta.env.VITE_BACKEND_URL}/cricsheet/${fileName}`;
    const res = await fetch(url);
    const json = await res.json();
    setMatchJson(json);
  }

  async function startMatch() {
    if (!matchFile || !matchJson) return;

    const matchId = crypto.randomUUID();

    await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/run-match/${matchId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchJson),
      }
    );

    navigate(`/scoreboard?matchId=${matchId}`);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Select Match</h2>

      <EventSelector
        index={index}
        value={event}
        onChange={(v) => {
          setEvent(v);
          setYear("");
          setFormat("");
          setMatchFile("");
        }}
      />

      <YearSelector
        index={index}
        event={event}
        value={year}
        onChange={(v) => {
          setYear(v);
          setFormat("");
          setMatchFile("");
        }}
      />

      <FormatSelector
        index={index}
        event={event}
        year={year}
        value={format}
        onChange={(v) => {
          setFormat(v);
          setMatchFile("");
        }}
      />

      <MatchSelector
        index={index}
        event={event}
        year={year}
        format={format}
        value={matchFile}
        onChange={(v) => {
          setMatchFile(v);
          loadMatchJson(v);
        }}
      />

      <button
        onClick={startMatch}
        disabled={!matchJson}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Start Match
      </button>
    </div>
  );
}
