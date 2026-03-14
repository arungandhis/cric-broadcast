import { useEffect } from "react";

export function useMatchEvents(onBall) {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/match");

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      onBall(event);
    };

    return () => ws.close();
  }, [onBall]);
}
