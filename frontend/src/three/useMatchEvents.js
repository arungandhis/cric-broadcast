import { useEffect } from "react";

export function useMatchEvents(matchId, onEvent) {
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

      // 🔥 Forward metadata
      if (event.type === "meta") {
        console.log("WS: Received metadata:", event);
        try {
          onEvent(event);
        } catch (err) {
          console.error("Error in onEvent handler (meta):", err);
        }
        return;
      }

      // 🔥 Forward ball events
      if (event.type === "ball") {
        try {
          onEvent(event);
        } catch (err) {
          console.error("Error in onEvent handler (ball):", err);
        }
        return;
      }

      console.warn("WS: Unknown event type:", event);
    };

    ws.onclose = () => console.log("WS closed for match", matchId);
    ws.onerror = (err) => console.error("WS error:", err);

    return () => ws.close();
  }, [matchId, onEvent]);
}
