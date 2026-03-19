import React, { useState, useCallback, useEffect } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

import { generateIPLCommentary } from "../engine/commentaryEngine";
import {
  formatBallLine,
  summarizeOver,
  partnershipLine,
  pressureLine,
  bowlerPressureLine,
  crowdReaction,
} from "../engine/commentaryHelpers";

function oversToFloat(over, ball) {
  return over + ball / 6;
}

function formatOvers(over, ball) {
  return `${over}.${ball}`;
}

function formatDismissal(d) {
  if (!d) return "out";
  switch (d.kind) {
    case "caught":
      return d.fielders?.length
        ? `c ${d.fielders.join(", ")} b ${d.bowler}`
        : `c ? b ${d.bowler}`;
    case "bowled":
      return `b ${d.bowler}`;
    case "lbw":
      return `lbw b ${d.bowler}`;
    case "stumped":
      return d.fielders?.length
        ? `st ${d.fielders.join(", ")} b ${d.bowler}`
        : `st ? b ${d.bowler}`;
    case "run out":
      return d.fielders?.length
        ? `run out (${d.fielders.join(", ")})`
        : "run out";
    case "hit wicket":
      return `hit wicket b ${d.bowler}`;
    case "retired hurt":
      return "retired hurt";
    default:
      return d.kind;
  }
}

export default function Scoreboard({ matchId }) {
  // ⭐ CONNECT TO BACKEND WEBSOCKET
  const WS_URL = `${import.meta.env.VITE_WS_URL}/ws/match/${matchId}`;
  const { events, connected, error } = useMatchEvents(WS_URL);

  // ⭐ Prevent blank screen
  if (!matchId) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        No matchId provided.
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <h2>Cricket Broadcast Engine</h2>
        <p style={{ color: "red" }}>WebSocket error: {error}</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <h2>Cricket Broadcast Engine</h2>
        <p>Connecting to live match feed…</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <h2>Cricket Broadcast Engine</h2>
        <p>Waiting for first ball…</p>
      </div>
    );
  }

  // ⭐ Now that events are flowing, use your existing logic
  // ------------------------------------------------------
  const [matchInfo, setMatchInfo] = useState({
    teamA: "",
    teamB: "",
    tossWinner: "",
    tossDecision: "",
    eventName: "",
  });

  const [commentary, setCommentary] = useState([]);

  const [innings, setInnings] = useState({
    1: {
      team: "",
      runs: 0,
      wickets: 0,
      over: 0,
      ball: 0,
      batters: {},
      bowlers: {},
      fow: [],
      striker: null,
      nonStriker: null,
      extras: {
        wides: 0,
        noballs: 0,
        legbyes: 0,
        byes: 0,
        penalty: 0,
        total: 0,
      },
    },
    2: {
      team: "",
      runs: 0,
      wickets: 0,
      over: 0,
      ball: 0,
      batters: {},
      bowlers: {},
      fow: [],
      striker: null,
      nonStriker: null,
      extras: {
        wides: 0,
        noballs: 0,
        legbyes: 0,
        byes: 0,
        penalty: 0,
        total: 0,
      },
    },
  });

  const [currentInnings, setCurrentInnings] = useState(1);
  const [target, setTarget] = useState(null);
  const [maxOvers, setMaxOvers] = useState(null);

  const [ballsThisOver, setBallsThisOver] = useState([]);
  const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });
  const [bowlerStats, setBowlerStats] = useState({});

  // ⭐ Handle metadata
  const handleMeta = useCallback((meta) => {
    setMatchInfo({
      teamA: meta.teamA || meta.teams?.[0] || "",
      teamB: meta.teamB || meta.teams?.[1] || "",
      tossWinner: meta.toss?.winner || "",
      tossDecision: meta.toss?.decision || "",
      eventName: meta.event?.name || "",
    });
  }, []);

  // ⭐ Handle ball events
  const handleBall = useCallback(
    (rawEvent) => {
      if (rawEvent.type === "meta") {
        handleMeta(rawEvent);
        return;
      }

      if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

      // ⭐ Your entire scoring + commentary logic stays unchanged
      // (I am not repeating it here — you already pasted it)
      // Just re‑use your existing code exactly as-is.

      // 👉 Insert your full handleBall logic here (unchanged)
      // I am not rewriting it because you already provided it
      // and it is correct.

    },
    [
      handleMeta,
      innings,
      ballsThisOver,
      partnership,
      bowlerStats,
      target,
      maxOvers,
    ]
  );

  // ⭐ Process incoming events from WebSocket
  useEffect(() => {
    events.forEach((ev) => handleBall(ev));
  }, [events, handleBall]);

  // ⭐ Your existing UI rendering stays exactly the same
  // (Batting tables, bowling tables, FOW, commentary, etc.)

  // 👉 Insert your full UI render code here (unchanged)
  // I am not rewriting it because you already pasted it
  // and it is correct.

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h2>Live Match</h2>
      <p>Connected: {connected ? "Yes" : "No"}</p>
      <p>Events received: {events.length}</p>

      {/* Your full UI goes here */}
    </div>
  );
}
