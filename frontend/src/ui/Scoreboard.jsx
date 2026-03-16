import React, { useState, useCallback } from "react";
import { useMatchEvents } from "../three/useMatchEvents";

function oversToFloat(over, ball) {
  return over + ball / 6;
}

function formatOvers(over, ball) {
  return `${over}.${ball}`;
}

export default function Scoreboard({ matchId }) {
  const [innings, setInnings] = useState({
    1: {
      team: "",
      runs: 0,
      wickets: 0,
      over: 0,
      ball: 0,
      batters: {}, // name -> { runs, balls, fours, sixes, out }
      bowlers: {}, // name -> { balls, runs, wickets }
      fow: [],     // [{ score, wicket, player, overStr }]
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
    },
  });

  const [currentInnings, setCurrentInnings] = useState(1);
  const [target, setTarget] = useState(null);
  const [maxOvers, setMaxOvers] = useState(null); // inferred from innings 1

  const handleBall = useCallback((rawEvent) => {
    if (!rawEvent || rawEvent.type !== "ball" || !rawEvent.event) return;

    const inn = rawEvent.inning;
    const team = rawEvent.team;
    const over = rawEvent.over;
    const ball = rawEvent.ball;
    const delivery = rawEvent.event;

    setCurrentInnings(inn);

    setInnings((prev) => {
      const curr = { ...prev[inn] };

      // Set team name
      if (!curr.team && team) {
        curr.team = team;
      }

      const runsObj = delivery.runs || {};
      const totalRuns = runsObj.total || 0;
      const batterRuns = runsObj.batter || 0;

      // Update team score
      const newRuns = curr.runs + totalRuns;
      let newWickets = curr.wickets;

      // Wickets + FOW
      if (delivery.wickets && delivery.wickets.length > 0) {
        delivery.wickets.forEach((w) => {
          newWickets += 1;
          curr.fow = [
            ...curr.fow,
            {
              score: newRuns,
              wicket: newWickets,
              player: w.player_out,
              overStr: formatOvers(over, ball),
            },
          ];
        });
      }

      // Update batters
      const batterName = delivery.batter;
      if (batterName) {
        const prevBatter = curr.batters[batterName] || {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          out: false,
        };

        const newBatter = { ...prevBatter };
        newBatter.runs += batterRuns;
        newBatter.balls += 1;

        if (batterRuns === 4) newBatter.fours += 1;
        if (batterRuns === 6) newBatter.sixes += 1;

        // Mark out if this batter is dismissed
        if (delivery.wickets) {
          delivery.wickets.forEach((w) => {
            if (w.player_out === batterName) {
              newBatter.out = true;
            }
          });
        }

        curr.batters = {
          ...curr.batters,
          [batterName]: newBatter,
        };
      }

      // Update bowlers
      const bowlerName = delivery.bowler;
      if (bowlerName) {
        const prevBowler = curr.bowlers[bowlerName] || {
          balls: 0,
          runs: 0,
          wickets: 0,
        };

        const newBowler = { ...prevBowler };
        newBowler.balls += 1;
        newBowler.runs += totalRuns;

        if (delivery.wickets && delivery.wickets.length > 0) {
          newBowler.wickets += delivery.wickets.length;
        }

        curr.bowlers = {
          ...curr.bowlers,
          [bowlerName]: newBowler,
        };
      }

      // Update over/ball from backend (Cricsheet keys)
      curr.runs = newRuns;
      curr.wickets = newWickets;
      curr.over = over;
      curr.ball = ball;

      return {
        ...prev,
        [inn]: curr,
      };
    });

    // When we see innings 2 for the first time, infer target and max overs
    if (inn === 2) {
      setInnings((prev) => {
        const inn1 = prev[1];
        if (target == null && inn1.runs > 0) {
          setTarget(inn1.runs + 1);
          const maxOv = inn1.over + 1; // last over index + 1
          setMaxOvers(maxOv);
        }
        return prev;
      });
    }
  }, [target, maxOvers]);

  useMatchEvents(matchId, handleBall);

  const inn1 = innings[1];
  const inn2 = innings[2];

  const inn1OversFloat = oversToFloat(inn1.over, inn1.ball);
  const inn2OversFloat = oversToFloat(inn2.over, inn2.ball);

  const inn1RR = inn1OversFloat > 0 ? (inn1.runs / inn1OversFloat).toFixed(2) : "-";
  const inn2RR = inn2OversFloat > 0 ? (inn2.runs / inn2OversFloat).toFixed(2) : "-";

  let rrr = "-";
  if (target && maxOvers && inn2OversFloat < maxOvers) {
    const remainingRuns = target - inn2.runs;
    const remainingOvers = maxOvers - inn2OversFloat;
    if (remainingRuns >
