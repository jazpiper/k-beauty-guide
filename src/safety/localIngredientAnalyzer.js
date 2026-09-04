import { normalizeIngredientName, splitIngredientText } from "./ingredientText";

const DISCLAIMER =
  "Ingredient information is educational and not a medical diagnosis.";

class AhoNode {
  constructor() {
    this.next = new Map();
    this.fail = null;
    this.minCandidateIndex = Infinity;
  }
}

let cachedKnownIngredientsRef = null;
let cachedIndex = null;

function getOrBuildKnownIngredientsIndex(knownIngredients) {
  if (
    cachedKnownIngredientsRef === knownIngredients &&
    cachedIndex !== null
  ) {
    return cachedIndex;
  }

  const exactMatchMap = new Map();
  const ahoRoot = new AhoNode();
  const candidateIndexToIngredient = [];
  let globalCandidateIndex = 0;

  for (const ingredient of knownIngredients || []) {
    const rawCandidates = [
      ingredient.name,
      ingredient.korean,
      ...(ingredient.aliases ?? []),
    ];

    for (let j = 0; j < rawCandidates.length; j++) {
      const cand = normalizeIngredientName(rawCandidates[j]);
      if (!cand) continue;

      if (!exactMatchMap.has(cand)) {
        exactMatchMap.set(cand, ingredient);
      }

      let node = ahoRoot;
      for (let k = 0; k < cand.length; k++) {
        const char = cand[k];
        let child = node.next.get(char);
        if (child === undefined) {
          child = new AhoNode();
          node.next.set(char, child);
        }
        node = child;
      }

      if (globalCandidateIndex < node.minCandidateIndex) {
        node.minCandidateIndex = globalCandidateIndex;
      }
      candidateIndexToIngredient[globalCandidateIndex] = ingredient;
      globalCandidateIndex++;
    }
  }

  const queue = [];
  for (const child of ahoRoot.next.values()) {
    child.fail = ahoRoot;
    queue.push(child);
  }

  let queueHead = 0;
  while (queueHead < queue.length) {
    const current = queue[queueHead++];
    for (const [char, child] of current.next.entries()) {
      let failNode = current.fail;
      while (failNode !== ahoRoot && !failNode.next.has(char)) {
        failNode = failNode.fail;
      }

      const matchedFail = failNode.next.get(char);
      if (matchedFail !== undefined) {
        child.fail = matchedFail;
      } else {
        child.fail = ahoRoot;
      }

      if (child.fail.minCandidateIndex < child.minCandidateIndex) {
        child.minCandidateIndex = child.fail.minCandidateIndex;
      }

      queue.push(child);
    }
  }

  cachedKnownIngredientsRef = knownIngredients;
  cachedIndex = {
    exactMatchMap,
    ahoRoot,
    candidateIndexToIngredient,
  };

  return cachedIndex;
}

export function analyzeKnownIngredientsLocally(
  ingredientText,
  knownIngredients,
) {
  const { exactMatchMap, ahoRoot, candidateIndexToIngredient } =
    getOrBuildKnownIngredientsIndex(knownIngredients);

  const parsedIngredients = splitIngredientText(ingredientText).map((token) => {
    const match = findLocalMatch(
      token.normalizedName,
      exactMatchMap,
      ahoRoot,
      candidateIndexToIngredient,
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

function findLocalMatch(
  normalizedRawName,
  exactMatchMap,
  ahoRoot,
  candidateIndexToIngredient,
) {
  const exactMatch = exactMatchMap.get(normalizedRawName);
  if (exactMatch) {
    return exactMatch;
  }

  let bestIndex = Infinity;
  let node = ahoRoot;

  for (let i = 0; i < normalizedRawName.length; i++) {
    const char = normalizedRawName[i];

    while (node !== ahoRoot && !node.next.has(char)) {
      node = node.fail;
    }

    if (node.next.has(char)) {
      node = node.next.get(char);
    } else {
      node = ahoRoot;
    }

    if (node.minCandidateIndex < bestIndex) {
      bestIndex = node.minCandidateIndex;
    }
  }

  if (bestIndex !== Infinity) {
    return candidateIndexToIngredient[bestIndex];
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
