import { useEffect, useRef, useState } from "react";

export function useMatchEvents(wsUrl) {
  // ⭐ Always return a safe default object
  const [state, setState] = useState({
    events: [],
    connected: false,
    error: null,
  });

  const wsRef = useRef(null);

  useEffect(() => {
    if (!wsUrl) {
      // No URL yet → keep defaults
      return;
    }

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

    ws.onerror = (err) => {
      console.error("WS error:", err);
      setState((s) => ({ ...s, error: "WebSocket error", connected: false }));
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
