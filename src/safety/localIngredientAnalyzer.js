import { normalizeIngredientName, splitIngredientText } from "./ingredientText";

class TrieNode {
  constructor() {
    this.children = {};
    this.fail = null;
    this.matches = [];
  }
}

class AhoCorasick {
  constructor() {
    this.root = new TrieNode();
  }

  addString(word, ingredient) {
    let node = this.root;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.matches.push(ingredient);
  }

  buildFailurePointers() {
    const queue = [];
    for (const key in this.root.children) {
      const child = this.root.children[key];
      child.fail = this.root;
      queue.push(child);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      for (const char in current.children) {
        const child = current.children[char];
        queue.push(child);
        let failNode = current.fail;
        while (failNode !== null && !failNode.children[char]) {
          failNode = failNode.fail;
        }
        child.fail = failNode ? failNode.children[char] : this.root;
        child.matches.push(...child.fail.matches);
      }
    }
  }

  search(text) {
    let node = this.root;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      while (node !== null && !node.children[char]) {
        node = node.fail;
      }
      if (node === null) {
        node = this.root;
        continue;
      }
      node = node.children[char];
      if (node.matches.length > 0) {
        return node.matches[0];
      }
    }
    return undefined;
  }
}

const DISCLAIMER =
  "Ingredient information is educational and not a medical diagnosis.";

let cachedKnownIngredients = null;
let cachedExactMatchMap = null;
let cachedAc = null;

export function analyzeKnownIngredientsLocally(
  ingredientText,
  knownIngredients,
) {
  if (knownIngredients !== cachedKnownIngredients) {
    cachedKnownIngredients = knownIngredients;
    cachedExactMatchMap = new Map();
    cachedAc = new AhoCorasick();

    for (const ingredient of knownIngredients) {
      const candidates = [
        ingredient.name,
        ingredient.korean,
        ...(ingredient.aliases ?? []),
      ]
        .map(normalizeIngredientName)
        .filter(Boolean);

      for (const candidate of candidates) {
        if (!cachedExactMatchMap.has(candidate)) {
          cachedExactMatchMap.set(candidate, ingredient);
        }
        cachedAc.addString(candidate, ingredient);
      }
    }
    cachedAc.buildFailurePointers();
  }

  const exactMatchMap = cachedExactMatchMap;
  const ac = cachedAc;

  const parsedIngredients = splitIngredientText(ingredientText).map((token) => {
    const match = findLocalMatch(token.normalizedName, exactMatchMap, ac);

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

function findLocalMatch(normalizedRawName, exactMatchMap, ac) {
  const exactMatch = exactMatchMap.get(normalizedRawName);
  if (exactMatch) {
    return exactMatch;
  }

  return ac.search(normalizedRawName);
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
