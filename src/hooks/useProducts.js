import { useEffect, useState } from "react";
import { fetchProducts } from "../api/productsApi";
import { fallbackProducts } from "../data/products";

export function useProducts() {
  const [products, setProducts] = useState(fallbackProducts);
  const [source, setSource] = useState("static");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchProducts()
      .then((result) => {
        if (!active) return;
        setProducts(result.items);
        setSource(result.source);
        setError(result.error);
      })
      .catch((err) => {
        if (!active) return;
        setProducts(fallbackProducts);
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

  return { products, source, error, loading };
}
