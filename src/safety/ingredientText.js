export function splitIngredientText(ingredientText) {
  return String(ingredientText || "")
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((rawName) => ({
      rawName,
      normalizedName: normalizeIngredientName(rawName),
    }))
    .filter((ingredient) => ingredient.normalizedName.length > 0)
    .map((ingredient, index) => ({
      position: index + 1,
      ...ingredient,
    }));
}

export function normalizeIngredientName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
