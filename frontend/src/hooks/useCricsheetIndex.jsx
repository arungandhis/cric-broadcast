import { useEffect, useState } from "react";

export function useCricsheetIndex() {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIndex() {
      try {
        const url = `${import.meta.env.VITE_BACKEND_URL}/cricsheet/index.json`;
        console.log("Fetching index from:", url);

        const res = await fetch(url);

        if (!res.ok) {
          console.error("Index fetch failed with status:", res.status);
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        setIndex(json);
      } catch (err) {
        console.error("Failed to load Cricsheet index:", err);
        setIndex(null);
      } finally {
        setLoading(false);
      }
    }

    loadIndex();
  }, []);

  return { index, loading };
}
