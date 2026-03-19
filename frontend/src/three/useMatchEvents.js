import { useEffect, useRef, useState } from "react";

export function useMatchEvents(wsUrl) {
  const [state, setState] = useState({
    events: [],
    connected: false,
    error: null,
  });

  const wsRef = useRef(null);

  useEffect(() => {
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true, error: null }));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setState((s) => ({
          ...s,
          events: [...s.events, data],
        }));
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onerror = () => {
      setState((s) => ({
        ...s,
        error: "WebSocket error",
        connected: false,
      }));
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [wsUrl]);

  return state;
}