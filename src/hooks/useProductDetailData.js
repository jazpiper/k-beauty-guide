import { useMemo } from "react";
import {
  asArray,
  normalizeImage,
  normalizeSourceLink,
  normalizePurchaseLink,
  mergeUniqueLinks,
  getSearchUrl,
  getHighestSeverity,
  getRecommendedProducts,
  formatPrice,
  formatDate,
} from "../utils/productUtils";

export function useProductDetailData(detailData = {}) {
  const {
    product = null,
    ingredients = [],
    flags = [],
    sources = [],
    images = [],
    recommendedProducts = [],
  } = detailData || {};

  const ingredientItems = useMemo(() => asArray(ingredients), [ingredients]);
  const flagItems = useMemo(() => asArray(flags), [flags]);

  const sourceLinks = useMemo(() => {
    const normalized = asArray(sources)
      .map(normalizeSourceLink)
      .filter(Boolean);
    const fromFlags = flagItems
      .map((flag) =>
        normalizeSourceLink({
          label:
            flag.sourceLabel ||
            `${flag.ingredientName || "Ingredient"} reference`,
          url: flag.sourceUrl,
          evidence:
            flag.whyItMatters || flag.description || flag.recommendation,
        }),
      )
      .filter(Boolean);
    return mergeUniqueLinks([...normalized, ...fromFlags]);
  }, [sources, flagItems]);

  const imageUrls = useMemo(
    () => asArray(images).map(normalizeImage).filter(Boolean),
    [images],
  );

  const purchaseLinks = useMemo(() => {
    const direct = asArray(product?.purchaseLinks || product?.buyLinks)
      .map(normalizePurchaseLink)
      .filter(Boolean);
    const brand = normalizePurchaseLink({
      label: "Official brand site",
      url: product?.brandOfficialUrl,
    });
    return mergeUniqueLinks([...direct, ...(brand ? [brand] : [])]);
  }, [product]);

  const flagCount = product?.safetyFlagCount ?? flagItems.length;
  const highestSeverity = getHighestSeverity(
    product,
    flagItems,
    ingredientItems,
  );

  const recommendedItems = useMemo(
    () =>
      getRecommendedProducts(
        product,
        recommendedProducts,
        highestSeverity,
        flagCount,
      ),
    [product, recommendedProducts, highestSeverity, flagCount],
  );

  const brandName = product?.brandName || product?.brand || "K-Beauty";
  const price = formatPrice(product);
  const updatedAt = formatDate(product?.updatedAt || product?.publishedAt);
  const hasWarnings = flagItems.length > 0 || flagCount > 0;
  const hasAnySourceEvidence = sourceLinks.some((item) => item.evidence);
  const fallbackSearchUrl = useMemo(() => getSearchUrl(product), [product]);

  return {
    ingredientItems,
    flagItems,
    sourceLinks,
    imageUrls,
    purchaseLinks,
    flagCount,
    highestSeverity,
    recommendedItems,
    brandName,
    price,
    updatedAt,
    hasWarnings,
    hasAnySourceEvidence,
    fallbackSearchUrl,
  };
}
