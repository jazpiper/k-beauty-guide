import { fallbackProducts } from "../data/products";
import { fallbackIngredients } from "../data/ingredients";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const PRODUCT_COLORS = ["#FFE4EC", "#FFD6E7", "#E8F4FD", "#E8F8E8", "#FFF3E0", "#F3E5F5"];
const CATEGORY_EMOJI = {
  Cleanser: "🧼",
  Essence: "💧",
  Moisturizer: "🧴",
  Serum: "✨",
  Sunscreen: "🌞",
  Toner: "🌿",
};

export async function fetchProducts() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      items: fallbackProducts,
      source: "static",
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("v_public_products")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) {
    return {
      items: fallbackProducts,
      source: "static",
      error: error.message,
    };
  }

  return {
    items: (data ?? []).map(mapProductRow),
    source: "supabase",
    error: null,
  };
}

export async function fetchProductDetail(slug) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("get_public_product_detail", {
      product_slug: slug,
    });

    if (!error && data) {
      return {
        ...mapProductDetail(data, "supabase"),
        error: null,
      };
    }
  }

  return buildFallbackProductDetail(slug);
}

function mapProductRow(row, index) {
  const category = row.category || "Product";
  const flagCount = row.flag_count ?? 0;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand_name,
    tag: flagCount > 0 ? `${flagCount} safety note${flagCount > 1 ? "s" : ""}` : "Published",
    price: formatKrw(row.price_krw, row.currency),
    skin: "All Skin",
    category,
    color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
    emoji: CATEGORY_EMOJI[category] || "🌸",
    rating: null,
    reviews: 0,
    primaryImageUrl: row.primary_image_url,
    highestSeverity: row.highest_severity,
    safetyFlagCount: flagCount,
    source: "supabase",
  };
}

function mapProductDetail(detail, source) {
  const flags = detail.safetyReport?.flags ?? [];
  const safetyFlagCount = flags.length;

  return {
    product: {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      brand: detail.brand?.name ?? "Unknown Brand",
      brandName: detail.brand?.name ?? "Unknown Brand",
      brandOfficialUrl: detail.brand?.officialUrl,
      category: detail.category || "Product",
      description: detail.description || "Product detail is being reviewed.",
      price: formatKrw(detail.priceKrw, detail.currency),
      priceKrw: detail.priceKrw,
      currency: detail.currency,
      primaryImageUrl: detail.primaryImageUrl,
      emoji: CATEGORY_EMOJI[detail.category] || "🌸",
      tag: safetyFlagCount > 0 ? `${safetyFlagCount} safety note${safetyFlagCount > 1 ? "s" : ""}` : "Published",
      safetyFlagCount,
      highestSeverity: getHighestSeverity(flags),
      publishedAt: detail.publishedAt,
      updatedAt: detail.updatedAt,
      source,
    },
    ingredients: (detail.ingredients ?? []).map(mapDetailIngredient),
    flags: flags.map(mapSafetyFlag),
    sources: detail.sources ?? [],
    images: detail.images ?? [],
    safetyReport: detail.safetyReport ?? { flags: [] },
    source,
  };
}

function mapDetailIngredient(ingredient) {
  return {
    id: ingredient.ingredientId ?? `${ingredient.position}-${ingredient.displayName}`,
    ingredientId: ingredient.ingredientId,
    position: ingredient.position,
    name: ingredient.displayName,
    canonicalName: ingredient.displayName,
    inciName: ingredient.inciName,
    korean: ingredient.koreanName || "",
    koreanName: ingredient.koreanName || "",
    reviewStatus: ingredient.reviewStatus,
    safety: ingredient.reviewStatus === "matched" ? "Info" : "Review",
  };
}

function mapSafetyFlag(flag) {
  return {
    id: flag.id,
    ingredientId: flag.ingredientId,
    ingredientName: flag.ingredientName || "Ingredient",
    severity: flag.severity || "info",
    title: flag.title || "Ingredient note",
    description: flag.whyItMatters || flag.recommendation || "",
    whyItMatters: flag.whyItMatters,
    whoShouldCare: flag.whoShouldCare,
    recommendation: flag.recommendation,
    sourceLabel: flag.sourceLabel,
    sourceRegion: flag.sourceRegion,
    sourceUrl: flag.sourceUrl,
  };
}

function buildFallbackProductDetail(slug) {
  const product = fallbackProducts.find((item) => item.slug === slug || item.id === slug);

  if (!product) {
    return {
      product: null,
      ingredients: [],
      flags: [],
      sources: [],
      images: [],
      safetyReport: { flags: [] },
      source: "static",
      error: "Product not found in fallback data.",
    };
  }

  const ingredients = selectFallbackIngredients(product);
  const flags = ingredients
    .filter((ingredient) => ingredient.safety === "Caution")
    .map((ingredient) => ({
      id: `${product.id}-${ingredient.id}`,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      severity: "caution",
      title: `${ingredient.name} may need extra care`,
      description: ingredient.desc,
      recommendation: "Patch test first and avoid if you already know this ingredient bothers your skin.",
      sourceLabel: "Static fallback",
    }));

  return {
    product: {
      ...product,
      brandName: product.brand,
      description: `${product.name} is available as static fallback content until Supabase product detail data is configured.`,
      safetyFlagCount: flags.length,
      highestSeverity: getHighestSeverity(flags),
      source: "static",
    },
    ingredients: ingredients.map((ingredient, index) => ({
      id: ingredient.id,
      ingredientId: ingredient.id,
      position: index + 1,
      name: ingredient.name,
      canonicalName: ingredient.name,
      korean: ingredient.korean,
      koreanName: ingredient.korean,
      reviewStatus: "matched",
      safety: ingredient.safety,
      benefit: ingredient.benefit,
      tags: ingredient.tags,
    })),
    flags,
    sources: [],
    images: [],
    safetyReport: {
      ingredientCount: ingredients.length,
      unmatchedIngredientCount: 0,
      flags,
    },
    source: "static",
    error: null,
  };
}

function selectFallbackIngredients(product) {
  const idsBySignal = [
    ["aha-bha", ["aha-glycolic-acid", "bha-salicylic-acid", "niacinamide", "fragrance"]],
    ["snail", ["snail-mucin", "hyaluronic-acid", "niacinamide", "fragrance"]],
    ["centella", ["centella-asiatica", "niacinamide", "hyaluronic-acid"]],
    ["green-tea", ["green-tea-extract", "hyaluronic-acid", "ceramides"]],
    ["lip", ["hyaluronic-acid", "vitamin-c", "fragrance"]],
    ["calming", ["centella-asiatica", "ceramides", "adenosine"]],
  ];
  const signal = `${product.slug} ${product.name}`.toLowerCase();
  const matched = idsBySignal.find(([key]) => signal.includes(key));
  const ids = matched?.[1] ?? ["hyaluronic-acid", "niacinamide", "centella-asiatica", "fragrance"];

  return ids
    .map((id) => fallbackIngredients.find((ingredient) => ingredient.id === id))
    .filter(Boolean);
}

function getHighestSeverity(flags) {
  const severityRank = {
    restricted: 4,
    avoid_if_sensitive: 3,
    caution: 2,
    info: 1,
  };

  return flags.reduce((highest, flag) => {
    const currentRank = severityRank[flag.severity] ?? 0;
    const highestRank = severityRank[highest] ?? 0;
    return currentRank > highestRank ? flag.severity : highest;
  }, null);
}

function formatKrw(priceKrw, currency) {
  if (typeof priceKrw !== "number") {
    return currency || "Price TBA";
  }

  return `₩${priceKrw.toLocaleString("ko-KR")}`;
}
