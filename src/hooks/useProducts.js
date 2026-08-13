import { fetchProducts } from "../api/productsApi";
import { fallbackProducts } from "../data/products";
import { useDataFetch } from "./useDataFetch";

export function useProducts() {
  const { data, source, error, loading } = useDataFetch(
    fetchProducts,
    fallbackProducts,
  );

  return { products: data, source, error, loading };
}
