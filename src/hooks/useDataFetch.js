import { useEffect, useState } from "react";

export function useDataFetch(fetchFn, fallbackData) {
  const [data, setData] = useState(fallbackData);
  const [source, setSource] = useState("static");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchFn()
      .then((result) => {
        if (!active) return;
        setData(result.items);
        setSource(result.source);
        setError(result.error);
      })
      .catch((err) => {
        if (!active) return;
        setData(fallbackData);
        setSource("static");
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchFn, fallbackData]);

  return { data, source, error, loading };
}
