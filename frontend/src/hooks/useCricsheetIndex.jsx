export function useCricsheetIndex() {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/cricsheet/index.json`
        );
        const json = await res.json();
        setIndex(json);
      } catch (err) {
        console.error("Failed to load Cricsheet index:", err);
        setIndex(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { index, loading };
}
