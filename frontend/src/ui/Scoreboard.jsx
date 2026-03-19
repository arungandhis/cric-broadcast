import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function Scoreboard() {
  const location = useLocation();

  // ⭐ Extract matchId from URL query params
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId");

  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    if (!matchId) {
      setStatus("no-match-id");
      return;
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/match/${matchId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "meta") {
        setMeta(data);
      } else if (data.type === "event") {
        setEvents((prev) => [...prev, data]);
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
    };

    return () => ws.close();
  }, [matchId]);

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h2>Live Scoreboard</h2>

      <div>Status: {status}</div>
      <div>Match ID: {matchId || "None"}</div>

      {meta && (
        <pre style={{ marginTop: 20, color: "yellow" }}>
          {JSON.stringify(meta, null, 2)}
        </pre>
      )}

      {events.length > 0 && (
        <pre style={{ marginTop: 20, color: "lightgreen" }}>
          {JSON.stringify(events, null, 2)}
        </pre>
      )}
    </div>
  );
}
