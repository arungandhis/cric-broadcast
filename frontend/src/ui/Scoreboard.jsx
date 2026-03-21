import { useState, useMemo } from "react";
import "./Scoreboard.css";

export default function Scoreboard({ data, isConnected }) {
  const [activeInnings, setActiveInnings] = useState(0);

  // Latest ball event
  const latestEvent = useMemo(() => {
    if (!data?.events || data.events.length === 0) return null;
    return data.events[data.events.length - 1];
  }, [data]);

  if (!data || !data.innings) {
    return (
      <div className="sb-root">
        <div className="sb-shell">
          <h2 className="sb-title">Cricket Broadcast Engine</h2>
          <p className="sb-subtitle">Loading match…</p>
        </div>
      </div>
    );
  }

  const innings = data.innings;
  const safeActive = Math.min(activeInnings, innings.length - 1);
  const currentInnings = innings[safeActive];

  return (
    <div className="sb-root">
      <div className="sb-shell">

        {/* Header */}
        <header className="sb-header">
          <div>
            <h2 className="sb-title">{data.match_title || "Live Cricket Match"}</h2>
            {data.venue && <p className="sb-venue">{data.venue}</p>}
          </div>

          <div className="sb-connection">
            <span className={`sb-dot ${isConnected ? "on" : "off"}`} />
            <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
          </div>
        </header>

        {/* Status */}
        <p className="sb-status">
          {data.status_text || (data.is_live ? "Match in progress" : "Waiting for match…")}
        </p>

        {/* Live ticker */}
        {latestEvent && (
          <div className="sb-live-banner">
            <span className="sb-live-pill">LIVE</span>
            <span className="sb-live-text">
              {latestEvent.over}.{latestEvent.ball} {latestEvent.text}
            </span>
          </div>
        )}

        {/* Innings Tabs */}
        <div className="sb-tabs">
          {innings.map((inn, idx) => (
            <button
              key={idx}
              className={`sb-tab ${safeActive === idx ? "active" : ""}`}
              onClick={() => setActiveInnings(idx)}
            >
              <div className="sb-tab-team">{inn.team}</div>
              <div className="sb-tab-score">
                {inn.runs}/{inn.wickets}
                <span className="sb-tab-overs">
                  {" "}
                  ({(inn.balls / 6).toFixed(1)} ov)
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Active Innings */}
        <InningsView innings={currentInnings} />
      </div>
    </div>
  );
}

function InningsView({ innings }) {
  const runRate =
    innings.balls > 0 ? (innings.runs / (innings.balls / 6)).toFixed(2) : "0.00";

  return (
    <div className="sb-innings">

      {/* Score Summary */}
      <section className="sb-score-card">
        <div className="sb-score-main">
          <div>
            <h3 className="sb-team-name">{innings.team}</h3>
            <div className="sb-score-line">
              <span className="sb-score">
                {innings.runs}/{innings.wickets}
              </span>
              <span className="sb-overs">
                ({(innings.balls / 6).toFixed(1)} ov)
              </span>
            </div>
          </div>

          <div className="sb-rr">
            <span className="sb-rr-label">CRR</span>
            <span className="sb-rr-value">{runRate}</span>
          </div>
        </div>

        <p className="sb-extras">
          Extras: {innings.extras.total} (b {innings.extras.b}, lb {innings.extras.lb}, w{" "}
          {innings.extras.w}, nb {innings.extras.nb}, p {innings.extras.p})
        </p>
      </section>

      {/* Batting */}
      <section className="sb-section">
        <h4 className="sb-section-title">Batting</h4>
        <div className="sb-table-wrapper">
          <table className="sb-table">
            <thead>
              <tr>
                <th>Batter</th>
                <th>Status</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {innings.batting.map((b, idx) => {
                const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={idx}>
                    <td>{b.name}</td>
                    <td className={b.status === "out" ? "sb-out" : "sb-notout"}>
                      {b.status}
                    </td>
                    <td>{b.runs}</td>
                    <td>{b.balls}</td>
                    <td>{b.fours}</td>
                    <td>{b.sixes}</td>
                    <td>{sr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bowling */}
      <section className="sb-section">
        <h4 className="sb-section-title">Bowling</h4>
        <div className="sb-table-wrapper">
          <table className="sb-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              {innings.bowling.map((bw, idx) => {
                const overs = (bw.balls / 6).toFixed(1);
                const econ =
                  bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(1) : "0.0";
                return (
                  <tr key={idx}>
                    <td>{bw.name}</td>
                    <td>{overs}</td>
                    <td>{bw.runs}</td>
                    <td>{bw.wickets}</td>
                    <td>{econ}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
