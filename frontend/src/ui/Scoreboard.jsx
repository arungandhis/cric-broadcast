import React, { useEffect, useState, useRef, useMemo } from "react";
import "./Scoreboard.css";

/**
 * Broadcast-grade Scoreboard
 *
 * - Multi-innings support
 * - Match header with teams, venue, status
 * - Current innings highlight
 * - Batting + bowling tables
 * - Fall of wickets
 * - Over-by-over timeline
 * - Recent events / commentary strip
 * - Manhattan graph placeholder
 * - Wagon wheel placeholder
 * - Partnership summary
 * - Responsive grid layout
 * - WebSocket live updates with reconnect
 */

const WS_URL_DEFAULT =
  import.meta.env.VITE_WS_URL ||
  "wss://cric-broadcast-backend.onrender.com/ws";

function formatOvers(balls) {
  if (balls === null || balls === undefined) return "-";
  const o = Math.floor(balls / 6);
  const b = balls % 6;
  return `${o}.${b}`;
}

function calcStrikeRate(runs, balls) {
  if (!balls) return "0.0";
  return ((runs / balls) * 100).toFixed(1);
}

function calcEconomy(runs, balls) {
  if (!balls) return "0.0";
  const overs = balls / 6;
  if (!overs) return "0.0";
  return (runs / overs).toFixed(1);
}

function safeNumber(n, fallback = 0) {
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

function formatExtras(extras) {
  if (!extras) return "0 (b 0, lb 0, w 0, nb 0, p 0)";
  const b = safeNumber(extras.b);
  const lb = safeNumber(extras.lb);
  const w = safeNumber(extras.w);
  const nb = safeNumber(extras.nb);
  const p = safeNumber(extras.p);
  const total = safeNumber(extras.total, b + lb + w + nb + p);
  return `${total} (b ${b}, lb ${lb}, w ${w}, nb ${nb}, p ${p})`;
}

function formatFOWEntry(entry) {
  if (!entry) return "";
  const { score, wicket, over, batter } = entry;
  return `${score}/${wicket} (${batter}, ${over})`;
}

function formatEventLabel(ev) {
  if (!ev) return "";
  const over = ev.over ?? "-";
  const ball = ev.ball ?? "-";
  const text = ev.text ?? "";
  return `${over}.${ball} ${text}`;
}

function formatMatchStatus(match) {
  if (!match) return "";
  if (match.result) return match.result;
  if (match.status_text) return match.status_text;
  if (match.is_live) return "Live";
  return "Match in progress";
}

function formatTeamName(team) {
  if (!team) return "";
  if (team.short_name) return team.short_name;
  if (team.name) return team.name;
  return String(team);
}

function formatInningsLabel(inn) {
  if (!inn) return "";
  const team = inn.team || inn.batting_team || "Team";
  const num = inn.innings_number || inn.number || "";
  return `${team} Innings${num ? ` ${num}` : ""}`;
}

function getCurrentInnings(innings) {
  if (!innings || innings.length === 0) return null;
  return innings[innings.length - 1];
}

function buildManhattanData(innings) {
  if (!innings || !innings.overs) return [];
  return innings.overs.map((ov) => ({
    over: ov.over_number,
    runs: ov.runs,
    wickets: ov.wickets,
  }));
}

function buildPartnership(innings) {
  if (!innings || !innings.partnership) return null;
  return innings.partnership;
}

function buildWagonWheelData(innings) {
  if (!innings || !innings.wagon_wheel) return [];
  return innings.wagon_wheel;
}

function useWebSocketMatch(wsUrl) {
  const [match, setMatch] = useState(null);
  const [status, setStatus] = useState("Connecting…");
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    function connect() {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected");
        // console.log("[WS] Connected");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          setMatch(data);
        } catch (err) {
          console.error("[WS] parse error:", err);
        }
      };

      ws.onclose = () => {
        setStatus("Disconnected — reconnecting…");
        // console.log("[WS] Disconnected, reconnecting in 3s…");
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        ws.close();
      };
    }

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [wsUrl]);

  return { match, status };
}

/* ------------------------------
 * Subcomponents
 * ------------------------------ */

function MatchHeader({ match, connectionStatus }) {
  if (!match) return null;

  const title = match.match_title || "Live Cricket Match";
  const venue = match.venue || "";
  const status = formatMatchStatus(match);

  const teamA = match.team_a || match.teams?.[0];
  const teamB = match.team_b || match.teams?.[1];

  return (
    <header className="sb-header">
      <div className="sb-header-main">
        <div className="sb-header-title-block">
          <h1 className="sb-match-title">{title}</h1>
          {venue && <div className="sb-match-venue">{venue}</div>}
          <div className="sb-match-status">{status}</div>
        </div>
        <div className="sb-header-teams">
          <div className="sb-team-block">
            <div className="sb-team-badge sb-team-badge-left">
              {formatTeamName(teamA)}
            </div>
          </div>
          <div className="sb-vs">vs</div>
          <div className="sb-team-block">
            <div className="sb-team-badge sb-team-badge-right">
              {formatTeamName(teamB)}
            </div>
          </div>
        </div>
      </div>
      <div className="sb-header-connection">
        <span className="sb-connection-dot" />
        <span className="sb-connection-text">{connectionStatus}</span>
      </div>
    </header>
  );
}

function CurrentInningsStrip({ innings }) {
  if (!innings) return null;

  const runs = safeNumber(innings.runs);
  const wickets = safeNumber(innings.wickets);
  const balls = safeNumber(innings.balls);
  const target = innings.target;
  const rr = innings.run_rate;
  const req_rr = innings.required_run_rate;

  return (
    <section className="sb-current-innings-strip">
      <div className="sb-current-score">
        <span className="sb-current-team">
          {innings.team || innings.batting_team || "Batting"}
        </span>
        <span className="sb-current-runs">
          {runs}/{wickets}
        </span>
        <span className="sb-current-overs">
          ({formatOvers(balls)} ov)
        </span>
      </div>
      <div className="sb-current-meta">
        {typeof target === "number" && (
          <span className="sb-current-target">Target: {target}</span>
        )}
        {typeof rr === "number" && (
          <span className="sb-current-rr">CRR: {rr.toFixed(2)}</span>
        )}
        {typeof req_rr === "number" && (
          <span className="sb-current-rr">Req RR: {req_rr.toFixed(2)}</span>
        )}
      </div>
    </section>
  );
}

function BattingTable({ innings }) {
  const batting = innings?.batting || [];

  return (
    <section className="sb-card sb-batting-card">
      <div className="sb-card-header">
        <h3>Batting</h3>
      </div>
      <div className="sb-card-body">
        <table className="sb-table sb-table-batting">
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
            {batting.map((b, idx) => (
              <tr key={idx}>
                <td className="sb-batter-name">{b.name}</td>
                <td className="sb-batter-status">{b.status}</td>
                <td>{safeNumber(b.runs)}</td>
                <td>{safeNumber(b.balls)}</td>
                <td>{safeNumber(b.fours)}</td>
                <td>{safeNumber(b.sixes)}</td>
                <td>{calcStrikeRate(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sb-extras-line">
          Extras: {formatExtras(innings?.extras)}
        </div>
        <div className="sb-total-line">
          Total: {safeNumber(innings?.runs)}/{safeNumber(innings?.wickets)} (
          {formatOvers(innings?.balls)} ov)
        </div>
      </div>
    </section>
  );
}

function BowlingTable({ innings }) {
  const bowling = innings?.bowling || [];

  return (
    <section className="sb-card sb-bowling-card">
      <div className="sb-card-header">
        <h3>Bowling</h3>
      </div>
      <div className="sb-card-body">
        <table className="sb-table sb-table-bowling">
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>M</th>
              <th>R</th>
              <th>W</th>
              <th>Econ</th>
            </tr>
          </thead>
          <tbody>
            {bowling.map((bw, idx) => (
              <tr key={idx}>
                <td className="sb-bowler-name">{bw.name}</td>
                <td>{formatOvers(bw.balls)}</td>
                <td>{safeNumber(bw.maidens)}</td>
                <td>{safeNumber(bw.runs)}</td>
                <td>{safeNumber(bw.wickets)}</td>
                <td>{calcEconomy(bw.runs, bw.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FallOfWickets({ innings }) {
  const fow = innings?.fall_of_wickets || innings?.fow || [];

  if (!fow.length) return null;

  return (
    <section className="sb-card sb-fow-card">
      <div className="sb-card-header">
        <h3>Fall of wickets</h3>
      </div>
      <div className="sb-card-body sb-fow-body">
        {fow.map((entry, idx) => (
          <div key={idx} className="sb-fow-entry">
            {formatFOWEntry(entry)}
          </div>
        ))}
      </div>
    </section>
  );
}

function OversTimeline({ innings }) {
  const overs = innings?.overs || [];

  if (!overs.length) return null;

  return (
    <section className="sb-card sb-overs-card">
      <div className="sb-card-header">
        <h3>Over by over</h3>
      </div>
      <div className="sb-card-body sb-overs-body">
        <div className="sb-overs-list">
          {overs.map((ov, idx) => (
            <div key={idx} className="sb-over-pill">
              <div className="sb-over-number">Over {ov.over_number}</div>
              <div className="sb-over-runs">
                {ov.runs} runs{ov.wickets ? `, ${ov.wickets} wkts` : ""}
              </div>
              <div className="sb-over-balls">
                {(ov.balls || []).map((b, i) => (
                  <span
                    key={i}
                    className={`sb-ball-pill sb-ball-${(b.result || "")
                      .toString()
                      .toLowerCase()}`}
                  >
                    {b.result}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentEvents({ match }) {
  const events = match?.events || [];
  if (!events.length) return null;

  const recent = events.slice(-8).reverse();

  return (
    <section className="sb-card sb-events-card">
      <div className="sb-card-header">
        <h3>Recent</h3>
      </div>
      <div className="sb-card-body sb-events-body">
        <ul className="sb-events-list">
          {recent.map((ev, idx) => (
            <li key={idx} className="sb-event-item">
              <span className="sb-event-over">
                {ev.over}.{ev.ball}
              </span>
              <span className="sb-event-text">{ev.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CommentaryStrip({ match }) {
  const events = match?.events || [];
  if (!events.length) {
    return (
      <div className="sb-commentary-strip sb-commentary-empty">
        Waiting for commentary…
      </div>
    );
  }

  const last = events[events.length - 1];
  const label = formatEventLabel(last);

  return (
    <div className="sb-commentary-strip">
      <div className="sb-commentary-pulse" />
      <div className="sb-commentary-label">Live</div>
      <div className="sb-commentary-text">{label}</div>
    </div>
  );
}

function ManhattanGraph({ innings }) {
  const data = useMemo(() => buildManhattanData(innings), [innings]);

  if (!data.length) {
    return (
      <section className="sb-card sb-manhattan-card">
        <div className="sb-card-header">
          <h3>Manhattan</h3>
        </div>
        <div className="sb-card-body sb-manhattan-body sb-manhattan-empty">
          Manhattan graph will appear here.
        </div>
      </section>
    );
  }

  const maxRuns = Math.max(...data.map((d) => d.runs), 1);

  return (
    <section className="sb-card sb-manhattan-card">
      <div className="sb-card-header">
        <h3>Manhattan</h3>
      </div>
      <div className="sb-card-body sb-manhattan-body">
        <div className="sb-manhattan-bars">
          {data.map((d, idx) => {
            const height = (d.runs / maxRuns) * 100;
            return (
              <div key={idx} className="sb-manhattan-bar-wrapper">
                <div
                  className="sb-manhattan-bar"
                  style={{ height: `${height}%` }}
                  title={`Over ${d.over}: ${d.runs} runs`}
                />
                <div className="sb-manhattan-over-label">{d.over}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WagonWheel({ innings }) {
  const data = useMemo(() => buildWagonWheelData(innings), [innings]);

  return (
    <section className="sb-card sb-wagon-card">
      <div className="sb-card-header">
        <h3>Wagon wheel</h3>
      </div>
      <div className="sb-card-body sb-wagon-body">
        <div className="sb-wagon-placeholder">
          {data.length === 0
            ? "Wagon wheel will appear here."
            : "Wagon wheel data available (rendering not implemented)."}
        </div>
      </div>
    </section>
  );
}

function PartnershipCard({ innings }) {
  const partnership = useMemo(() => buildPartnership(innings), [innings]);

  if (!partnership) return null;

  const { runs, balls, batters } = partnership;

  return (
    <section className="sb-card sb-partnership-card">
      <div className="sb-card-header">
        <h3>Partnership</h3>
      </div>
      <div className="sb-card-body sb-partnership-body">
        <div className="sb-partnership-main">
          <div className="sb-partnership-runs">
            {runs} ({balls} balls)
          </div>
          <div className="sb-partnership-batters">
            {(batters || []).map((b, idx) => (
              <div key={idx} className="sb-partnership-batter">
                <div className="sb-partnership-batter-name">{b.name}</div>
                <div className="sb-partnership-batter-stats">
                  {b.runs} ({b.balls})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AllInningsSummary({ innings }) {
  if (!innings || innings.length === 0) return null;

  return (
    <section className="sb-card sb-innings-summary-card">
      <div className="sb-card-header">
        <h3>Innings summary</h3>
      </div>
      <div className="sb-card-body sb-innings-summary-body">
        {innings.map((inn, idx) => (
          <div key={idx} className="sb-innings-summary-row">
            <div className="sb-innings-summary-label">
              {formatInningsLabel(inn)}
            </div>
            <div className="sb-innings-summary-score">
              {safeNumber(inn.runs)}/{safeNumber(inn.wickets)} (
              {formatOvers(inn.balls)} ov)
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------
 * Main Scoreboard Component
 * ------------------------------ */

export default function Scoreboard() {
  const { match, status } = useWebSocketMatch(WS_URL_DEFAULT);

  const innings = match?.innings || [];
  const currentInnings = getCurrentInnings(innings);

  if (!match) {
    return (
      <div className="sb-root sb-root-loading">
        <div className="sb-loading-card">
          <h2>Loading match…</h2>
          <p>{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sb-root">
      <MatchHeader match={match} connectionStatus={status} />

      <CommentaryStrip match={match} />

      <CurrentInningsStrip innings={currentInnings} />

      <main className="sb-layout">
        <div className="sb-layout-main">
          <BattingTable innings={currentInnings} />
          <BowlingTable innings={currentInnings} />
          <FallOfWickets innings={currentInnings} />
          <OversTimeline innings={currentInnings} />
        </div>

        <aside className="sb-layout-side">
          <AllInningsSummary innings={innings} />
          <PartnershipCard innings={currentInnings} />
          <ManhattanGraph innings={currentInnings} />
          <WagonWheel innings={currentInnings} />
          <RecentEvents match={match} />
        </aside>
      </main>
    </div>
  );
}
