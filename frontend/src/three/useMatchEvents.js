import { useEffect } from "react";

export function useMatchEvents(matchId, onBall) {
  useEffect(() => {
    if (!matchId) return;

    const ws = new WebSocket(
      `wss://cric-broadcast-backed.onrender.com/ws/match/${matchId}`
    );

    ws.onopen = () => console.log("WS connected for match", matchId);

    ws.onmessage = (msg) => {
      console.log("WS raw message:", msg.data);

      let event;
      try {
        event = JSON.parse(msg.data);
      } catch (err) {
        console.error("Failed to parse WS message:", err);
        return;
      }

      try {
        onBall(event);
      } catch (err) {
        console.error("Error in onBall handler:", err);
      }
    };

    ws.onclose = () => console.log("WS closed for match", matchId);
    ws.onerror = (err) => console.error("WS error:", err);

    return () => ws.close();
  }, [matchId, onBall]);
}
