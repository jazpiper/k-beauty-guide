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

  describe("normalizeIngredientName", () => {
    test("handles falsy values safely", () => {
      expect(normalizeIngredientName(null)).toBe("");
      expect(normalizeIngredientName(undefined)).toBe("");
      expect(normalizeIngredientName("")).toBe("");
    });

    test("converts to lowercase", () => {
      expect(normalizeIngredientName("WATER")).toBe("water");
      expect(normalizeIngredientName("Water")).toBe("water");
    });

    test("removes parenthetical texts", () => {
      expect(normalizeIngredientName("Sodium Hyaluronate (1%)")).toBe("sodium hyaluronate");
      expect(normalizeIngredientName("(organic) Aloe Vera")).toBe("aloe vera");
      expect(normalizeIngredientName("Extract (from plants) water")).toBe("extract water");
    });

    test("replaces non-alphanumeric and non-Korean characters with spaces", () => {
      expect(normalizeIngredientName("PEG-100 Stearate")).toBe("peg 100 stearate");
      expect(normalizeIngredientName("Parfum/Fragrance")).toBe("parfum fragrance");
      expect(normalizeIngredientName("1,2-Hexanediol")).toBe("1 2 hexanediol");
      expect(normalizeIngredientName("Ingredient.Name")).toBe("ingredient name");
    });

    test("normalizes multiple consecutive spaces", () => {
      expect(normalizeIngredientName("  Water   and   Glycerin  ")).toBe("water and glycerin");
    });

    test("handles Korean text correctly", () => {
      expect(normalizeIngredientName("정제수")).toBe("정제수");
      expect(normalizeIngredientName("글리세린 (Glycerin)")).toBe("글리세린");
      expect(normalizeIngredientName("향료/Fragrance")).toBe("향료 fragrance");
    });

    test("handles a complex combination", () => {
      expect(normalizeIngredientName("  PEG-60 Hydrogenated Castor Oil (and) Water / 정제수  ")).toBe("peg 60 hydrogenated castor oil water 정제수");
    });
  });
});
