import { useEffect } from "react";

export function useMatchEvents(onBall) {
  useEffect(() => {
    const ws = new WebSocket("wss://cric-broadcast-backed.onrender.com/ws/match");

    ws.onopen = () => {
      console.log("WS connected");
    };

    ws.onmessage = (msg) => {
      console.log("WS raw message:", msg.data);

      try {
        const event = JSON.parse(msg.data);
        onBall(event);
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WS closed");
    };

    return () => ws.close();
  }, [onBall]);
}
