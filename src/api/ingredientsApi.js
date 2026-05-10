import { fallbackIngredients } from "../data/ingredients";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { analyzeKnownIngredientsLocally } from "../safety/localIngredientAnalyzer";

const BENEFIT_LABELS = {
  barrier: "Barrier",
  hydration: "Hydration",
  soothing: "Soothing",
  scent: "Scent",
};

const FUNCTION_EMOJI = {
  fragrance: "🌸",
  humectant: "💧",
  skin_conditioning: "🐌",
};

export async function fetchIngredients() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      items: fallbackIngredients,
      source: "static",
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("v_public_ingredients")
    .select("*")
    .order("canonical_name", { ascending: true });

  if (error) {
    return {
      items: fallbackIngredients,
      source: "static",
      error: error.message,
    };
  }

  return {
    items: (data ?? []).map(mapIngredientRow),
    source: "supabase",
    error: null,
  };
}

export async function analyzeIngredientText(ingredientText, knownIngredients) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke("analyze-ingredient-text", {
      body: { ingredientText },
    });

    if (!error && data?.ok && data.data) {
      return {
        ...data.data,
        source: "supabase",
        error: null,
      };
    }
  }

  return analyzeKnownIngredientsLocally(
    ingredientText,
    mergeIngredientsForLocalAnalysis(knownIngredients)
  );
}

function mergeIngredientsForLocalAnalysis(knownIngredients) {
  const byIdOrName = new Map();

  [...fallbackIngredients, ...(knownIngredients ?? [])].forEach((ingredient) => {
    const key = ingredient.id || ingredient.name;
    if (!key) return;

    const existing = byIdOrName.get(key);
    byIdOrName.set(key, {
      ...ingredient,
      aliases: ingredient.aliases ?? existing?.aliases ?? [],
    });
  });

  return [...byIdOrName.values()];
}

function mapIngredientRow(row) {
  const functionTags = row.function_tags ?? [];
  const benefitTags = row.benefit_tags ?? [];
  const primaryBenefit = benefitTags[0] || functionTags[0] || "info";
  const safetySignalCount = row.safety_signal_count ?? 0;

  return {
    id: row.id,
    name: row.canonical_name,
    korean: row.korean_name || "",
    safety: safetySignalCount > 0 ? "Caution" : "Safe",
    benefit: BENEFIT_LABELS[primaryBenefit] || titleCase(primaryBenefit),
    desc: row.definition,
    emoji: FUNCTION_EMOJI[functionTags[0]] || "🔬",
    color: safetySignalCount > 0 ? "#FFF3E0" : "#E8F5E9",
    tags: [...benefitTags, ...functionTags].slice(0, 3).map(titleCase),
    safetySignalCount,
    source: "supabase",
  };
}

function titleCase(value) {
  return String(value || "Info")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
