import { useEffect, useState } from "react";
import { fetchIngredients } from "../api/ingredientsApi";
import { fallbackIngredients } from "../data/ingredients";

export function useIngredients() {
  const [ingredients, setIngredients] = useState(fallbackIngredients);
  const [source, setSource] = useState("static");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchIngredients()
      .then((result) => {
        if (!active) return;
        setIngredients(result.items);
        setSource(result.source);
        setError(result.error);
      })
      .catch((err) => {
        if (!active) return;
        setIngredients(fallbackIngredients);
        setSource("static");
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { ingredients, source, error, loading };
}
