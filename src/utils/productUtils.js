import { SEVERITY_RANK } from "../constants/severity";
import { fallbackProducts } from "../data/products";

export const severityRank = SEVERITY_RANK;

export function isSafeHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeHttpUrl(value) {
  return isSafeHttpUrl(value) ? value : "";
}

export function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function normalizeImage(image) {
  if (!image) return null;
  if (typeof image === "string") return image;
  return image.url || image.src || image.imageUrl || image.publicUrl || null;
}

export function normalizeSourceLink(source) {
  if (!source) return null;
  const rawUrl =
    typeof source === "string"
      ? source
      : source.url || source.href || source.sourceUrl;
  const url = sanitizeHttpUrl(rawUrl);

  let label =
    typeof source === "string"
      ? ""
      : source.label || source.title || source.name || "";
  if (url) {
    try {
      const parsed = new URL(url);
      label = label || parsed.hostname.replace(/^www\./, "");
    } catch {
      label = label || rawUrl;
    }
  }

  return {
    url: url || "",
    label: label || "Source",
    evidence:
      typeof source === "object"
        ? source.evidence || source.description || ""
        : "",
    publishedAt:
      typeof source === "object" ? source.publishedAt || source.date || "" : "",
  };
}

export function normalizePurchaseLink(link) {
  if (!link) return null;
  if (typeof link === "string") {
    const url = sanitizeHttpUrl(link);
    return url ? { label: "Buy now", url } : null;
  }
  const url = sanitizeHttpUrl(link.url || link.href || link.link);
  if (!url) return null;
  return { label: link.label || link.name || "Buy now", url };
}

export function normalizeRecommendedProduct(item) {
  if (!item) return null;
  return {
    id: item.id || item.slug || item.name,
    slug: item.slug || item.id,
    name: item.name || "Recommended product",
    brand: item.brandName || item.brand || "K-Beauty",
    category: item.category || "",
    skin: item.skin || "",
    highestSeverity: normalizeSeverity(item.highestSeverity),
  };
}

export function mergeUniqueLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    const key = link.url || `${link.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getSearchUrl(product) {
  if (!product?.name && !product?.brand) return "";
  return sanitizeHttpUrl(
    `https://www.google.com/search?q=${encodeURIComponent(`${product?.brand || ""} ${product?.name || ""}`.trim())}`,
  );
}

export function normalizeSeverity(value) {
  if (!value) return "none";
  return String(value).toLowerCase();
}

export function getSeverityLabel(value) {
  const severity = normalizeSeverity(value);
  if (severity === "none") return "No flags";
  if (severity === "avoid_if_sensitive") return "Avoid if sensitive";
  return severity
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getHighestSeverity(product, flags, ingredients) {
  if (product?.highestSeverity)
    return normalizeSeverity(product.highestSeverity);
  const severities = [
    ...asArray(flags).map((flag) => flag?.severity),
    ...asArray(ingredients).map(
      (ingredient) => ingredient?.highestSeverity || ingredient?.safety,
    ),
  ].map(normalizeSeverity);

  const highest = severities.sort(
    (a, b) => (severityRank[b] ?? 0) - (severityRank[a] ?? 0),
  )[0];
  return severityRank[highest] !== undefined ? highest : "none";
}

export function formatPrice(product) {
  if (!product) return "";
  if (product.price && typeof product.price === "string") return product.price;
  if (product.priceKrw != null) {
    const priceKrw = Number(String(product.priceKrw).replace(/[^\d.]/g, ""));
    return Number.isFinite(priceKrw)
      ? `₩${priceKrw.toLocaleString("ko-KR")}`
      : String(product.priceKrw);
  }
  if (product.price && product.currency) {
    const amount = Number(product.price);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: product.currency,
        }).format(amount)
      : `${product.currency} ${product.price}`;
  }
  if (product.price) return String(product.price);
  return "";
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getRecommendedProducts(
  product,
  recommendedProducts = [],
  highestSeverity = "none",
  flagCount = 0,
) {
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
}
