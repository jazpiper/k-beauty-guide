import { fetchIngredients } from "../api/ingredientsApi";
import { fallbackIngredients } from "../data/ingredients";
import { useDataFetch } from "./useDataFetch";

export function useIngredients() {
  const { data, source, error, loading } = useDataFetch(
    fetchIngredients,
    fallbackIngredients,
  );

  return { ingredients: data, source, error, loading };
}
