import { useEffect, useState } from "react";
import { fetchProductDetail } from "../api/productsApi";

const emptyDetail = {
  product: null,
  ingredients: [],
  flags: [],
  sources: [],
  images: [],
  safetyReport: { flags: [] },
  source: "static",
  error: null,
};

export function useProductDetail(slug) {
  const [state, setState] = useState({
    ...emptyDetail,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setState((current) => ({ ...current, loading: true }));

      try {
        const result = await fetchProductDetail(slug);
        if (active) {
          setState({
            ...emptyDetail,
            ...result,
            loading: false,
          });
        }
      } catch (error) {
        if (active) {
          setState({
            ...emptyDetail,
            loading: false,
            error: error.message,
          });
        }
      }
    }

    if (slug) {
      loadDetail();
    } else {
      setState({ ...emptyDetail, loading: false, error: "Missing product slug." });
    }

    return () => {
      active = false;
    };
  }, [slug]);

  return state;
}
