import { analyzeKnownIngredientsLocally } from "./localIngredientAnalyzer";

const knownIngredients = [
  {
    id: "hyaluronic-acid",
    name: "Hyaluronic Acid",
    korean: "히알루론산",
    aliases: ["Sodium Hyaluronate"],
    safety: "Safe",
    color: "#E3F2FD",
  },
  {
    id: "fragrance",
    name: "Fragrance",
    korean: "향료",
    aliases: ["Parfum", "Perfume"],
    safety: "Caution",
    color: "#FFF0F5",
  },
];

describe("localIngredientAnalyzer", () => {
  test("matches aliases and canonical names", () => {
    const result = analyzeKnownIngredientsLocally("Water, Parfum, Sodium Hyaluronate", knownIngredients);

    expect(result.source).toBe("static");
    expect(result.parsedIngredients).toEqual([
      expect.objectContaining({
        position: 1,
        rawName: "Water",
        ingredientId: null,
        displayName: "Water",
        matchMethod: "unmatched",
        confidence: 0,
        safety: "Review",
      }),
      expect.objectContaining({
        position: 2,
        rawName: "Parfum",
        ingredientId: "fragrance",
        displayName: "Fragrance",
        matchMethod: "local_match",
        confidence: 0.85,
        safety: "Caution",
      }),
      expect.objectContaining({
        position: 3,
        rawName: "Sodium Hyaluronate",
        ingredientId: "hyaluronic-acid",
        displayName: "Hyaluronic Acid",
        matchMethod: "local_match",
        confidence: 0.85,
        safety: "Safe",
      }),
    ]);
    expect(result.unmatchedCount).toBe(1);
  });

  test("generates caution flags for matched caution ingredients", () => {
    const result = analyzeKnownIngredientsLocally("Fragrance", knownIngredients);

    expect(result.flags).toEqual([
      {
        ingredientId: "fragrance",
        ingredientName: "Fragrance",
        severity: "caution",
        title: "Fragrance may need extra care",
        whyItMatters: "Fragrance may bother sensitive or allergy-prone skin.",
        recommendation: "Patch test first and avoid if this ingredient has bothered your skin before.",
        sourceLabel: "Static fallback",
      },
    ]);
  });

  test("does not reverse-match shorter raw names against longer aliases", () => {
    const result = analyzeKnownIngredientsLocally("Oil", [
      {
        id: "essential-oil",
        name: "Essential Oil Blend",
        korean: "",
        aliases: ["Essential Oil"],
        safety: "Caution",
        color: "#FFF0F5",
      },
    ]);

    expect(result.parsedIngredients).toEqual([
      expect.objectContaining({
        rawName: "Oil",
        ingredientId: null,
        displayName: "Oil",
        matchMethod: "unmatched",
        confidence: 0,
        safety: "Review",
      }),
    ]);
    expect(result.unmatchedCount).toBe(1);
  });
});
