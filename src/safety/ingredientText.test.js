import { normalizeIngredientName, splitIngredientText } from "./ingredientText";

describe("ingredientText", () => {
  test("splits comma and semicolon separated ingredient text", () => {
    expect(splitIngredientText("Water, Fragrance; Sodium Hyaluronate")).toEqual([
      { position: 1, rawName: "Water", normalizedName: "water" },
      { position: 2, rawName: "Fragrance", normalizedName: "fragrance" },
      { position: 3, rawName: "Sodium Hyaluronate", normalizedName: "sodium hyaluronate" },
    ]);
  });

  test("drops empty tokens and trims whitespace", () => {
    expect(splitIngredientText("  Water, ,  Fragrance  , ")).toEqual([
      { position: 1, rawName: "Water", normalizedName: "water" },
      { position: 2, rawName: "Fragrance", normalizedName: "fragrance" },
    ]);
  });

  test("renumbers tokens after normalized-empty values are dropped", () => {
    expect(splitIngredientText("Water, (1%), Fragrance")).toEqual([
      { position: 1, rawName: "Water", normalizedName: "water" },
      { position: 2, rawName: "Fragrance", normalizedName: "fragrance" },
    ]);
  });

  test("handles null, undefined, and empty string safely", () => {
    expect(splitIngredientText(null)).toEqual([]);
    expect(splitIngredientText(undefined)).toEqual([]);
    expect(splitIngredientText("")).toEqual([]);
  });

  test("normalizes case, parenthetical notes, punctuation, and Korean text", () => {
    expect(normalizeIngredientName("  Sodium Hyaluronate (1%) ")).toBe("sodium hyaluronate");
    expect(normalizeIngredientName("Parfum/Fragrance")).toBe("parfum fragrance");
    expect(normalizeIngredientName("향료")).toBe("향료");
  });

  test("normalizes null, undefined, and empty string safely", () => {
    expect(normalizeIngredientName(null)).toBe("");
    expect(normalizeIngredientName(undefined)).toBe("");
    expect(normalizeIngredientName("")).toBe("");
  });
});
