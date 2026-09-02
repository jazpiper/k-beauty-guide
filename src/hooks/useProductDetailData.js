import { useMemo } from "react";
import { fallbackProducts } from "../data/products";
import {
  severityRank,
  asArray,
  normalizeImage,
  normalizeSourceLink,
  normalizePurchaseLink,
  normalizeRecommendedProduct,
  mergeUniqueLinks,
  getSearchUrl,
  getHighestSeverity,
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

  const recommendedItems = useMemo(() => {
    const fromDetail = asArray(recommendedProducts)
      .map(normalizeRecommendedProduct)
      .filter(Boolean);
    if (fromDetail.length > 0) return fromDetail.slice(0, 3);

    if (!product) return [];
    const currentSkinSignal = String(product.skin || "")
      .toLowerCase()
      .split("/")[0];
    const currentSeverityRank = severityRank[highestSeverity] ?? 0;
    const hasSafetySignals = currentSeverityRank > 0 || flagCount > 0;

    return fallbackProducts
      .filter((item) => item.slug !== product.slug)
      .map(normalizeRecommendedProduct)
      .sort((a, b) => {
        const scoreItem = (item) => {
          let score = 0;
          if (item.category && item.category === product.category) score += 3;
          if (
            currentSkinSignal &&
            item.skin &&
            item.skin.toLowerCase().includes(currentSkinSignal)
          )
            score += 2;
          if (hasSafetySignals) {
            const text = `${item.name || ""} ${item.brand || ""}`.toLowerCase();
            if (
              text.includes("gentle") ||
              text.includes("calming") ||
              text.includes("soonjung")
            )
              score += 2;
            if (text.includes("unscented") || text.includes("centella"))
              score += 1;
          }
          return score;
        };
        return scoreItem(b) - scoreItem(a);
      })
      .slice(0, 3);
  }, [recommendedProducts, product, highestSeverity, flagCount]);

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
