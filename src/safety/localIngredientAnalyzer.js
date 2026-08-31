import { normalizeIngredientName, splitIngredientText } from "./ingredientText";

const DISCLAIMER =
  "Ingredient information is educational and not a medical diagnosis.";

export function analyzeKnownIngredientsLocally(
  ingredientText,
  knownIngredients,
) {
  const exactMatchMap = new Map();
  const candidateList = [];

  for (let i = 0; i < knownIngredients.length; i++) {
    const ingredient = knownIngredients[i];
    const candidates = [
      ingredient.name,
      ingredient.korean,
      ...(ingredient.aliases ?? []),
    ]
      .map(normalizeIngredientName)
      .filter(Boolean);

    for (let j = 0; j < candidates.length; j++) {
      const candidate = candidates[j];
      if (!exactMatchMap.has(candidate)) {
        exactMatchMap.set(candidate, ingredient);
      }
      candidateList.push({ candidate, ingredient });
    }
  }

  const parsedIngredients = splitIngredientText(ingredientText).map((token) => {
    const match = findLocalMatch(
      token.normalizedName,
      exactMatchMap,
      candidateList,
    );

    if (!match) {
      return {
        position: token.position,
        rawName: token.rawName,
        ingredientId: null,
        displayName: token.rawName,
        matchMethod: "unmatched",
        confidence: 0,
        safety: "Review",
        color: "#FFF0F5",
      };
    }

    return {
      position: token.position,
      rawName: token.rawName,
      ingredientId: match.id,
      displayName: match.name,
      matchMethod: "local_match",
      confidence: 0.85,
      safety: match.safety,
      color: match.color,
    };
  });

  return {
    parsedIngredients,
    flags: buildLocalFlags(parsedIngredients),
    unmatchedCount: parsedIngredients.filter(
      (ingredient) => !ingredient.ingredientId,
    ).length,
    disclaimer: DISCLAIMER,
    source: "static",
    error: null,
  };
}

function findLocalMatch(normalizedRawName, exactMatchMap, candidateList) {
  const exactMatch = exactMatchMap.get(normalizedRawName);
  if (exactMatch) {
    return exactMatch;
  }

  for (let i = 0; i < candidateList.length; i++) {
    if (normalizedRawName.includes(candidateList[i].candidate)) {
      return candidateList[i].ingredient;
    }
  }

  return undefined;
}

function buildLocalFlags(parsedIngredients) {
  return parsedIngredients
    .filter(
      (ingredient) =>
        ingredient.ingredientId && ingredient.safety === "Caution",
    )
    .map((ingredient) => ({
      ingredientId: ingredient.ingredientId,
      ingredientName: ingredient.displayName,
      severity: "caution",
      title: `${ingredient.displayName} may need extra care`,
      whyItMatters: `${ingredient.displayName} may bother sensitive or allergy-prone skin.`,
      recommendation:
        "Patch test first and avoid if this ingredient has bothered your skin before.",
      sourceLabel: "Static fallback",
    }));
}
