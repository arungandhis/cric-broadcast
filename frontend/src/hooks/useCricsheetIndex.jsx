import { useEffect, useState } from "react";

export function useCricsheetIndex() {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const url = `${import.meta.env.VITE_BACKEND_URL}/cricsheet/index.json`;
      console.log("Fetching index from:", url);

      try {
        const res = await fetch(url);

        if (!res.ok) {
          console.error("Backend returned error:", res.status);
          setIndex(null);
          return;
        }

        const json = await res.json();
        console.log("Received index:", json);

        setIndex(json);
      } catch (err) {
        console.error("Fetch error:", err);
        setIndex(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { index, loading };
}
