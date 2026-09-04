import { renderHook } from "@testing-library/react";
import { useProductDetailData } from "./useProductDetailData";

describe("useProductDetailData", () => {
  it("returns default structured object when called with no arguments or empty object / null", () => {
    const { result: resultEmpty } = renderHook(() => useProductDetailData());
    expect(resultEmpty.current).toEqual({
      ingredientItems: [],
      flagItems: [],
      sourceLinks: [],
      imageUrls: [],
      purchaseLinks: [],
      flagCount: 0,
      highestSeverity: "none",
      recommendedItems: [],
      brandName: "K-Beauty",
      price: "",
      updatedAt: "",
      hasWarnings: false,
      hasAnySourceEvidence: false,
      fallbackSearchUrl: "",
    });

    const { result: resultNull } = renderHook(() => useProductDetailData(null));
    expect(resultNull.current.brandName).toBe("K-Beauty");
    expect(resultNull.current.flagCount).toBe(0);
    expect(resultNull.current.hasWarnings).toBe(false);
  });

  it("handles basic product metadata (brand, price, dates, fallback search URL)", () => {
    const detailData = {
      product: {
        name: "Hydrating Cleanser",
        brandName: "Beauty Brand",
        priceKrw: 15000,
        updatedAt: "2024-01-15T00:00:00Z",
      },
    };

    const { result } = renderHook(() => useProductDetailData(detailData));

    expect(result.current.brandName).toBe("Beauty Brand");
    expect(result.current.price).toBe("₩15,000");
    expect(result.current.updatedAt).toBe("Jan 15, 2024");
    expect(result.current.fallbackSearchUrl).toBe(
      "https://www.google.com/search?q=Hydrating%20Cleanser",
    );
  });

  it("uses product.brand fallback if brandName is not present and includes brand in search URL", () => {
    const detailData = {
      product: {
        name: "Serum",
        brand: "Secondary Brand",
      },
    };

    const { result } = renderHook(() => useProductDetailData(detailData));
    expect(result.current.brandName).toBe("Secondary Brand");
    expect(result.current.fallbackSearchUrl).toBe(
      "https://www.google.com/search?q=Secondary%20Brand%20Serum",
    );
  });

  it("processes ingredients and flags properly", () => {
    const detailData = {
      ingredients: [
        { name: "Water", safety: "low" },
        { name: "Fragrance", safety: "high" },
      ],
      flags: [
        {
          ingredientName: "Fragrance",
          severity: "high",
          sourceLabel: "EWG",
          sourceUrl: "https://example.com/ewg-fragrance",
          whyItMatters: "May cause allergy",
        },
      ],
    };

    const { result } = renderHook(() => useProductDetailData(detailData));

    expect(result.current.ingredientItems).toHaveLength(2);
    expect(result.current.flagItems).toHaveLength(1);
    expect(result.current.flagCount).toBe(1);
    expect(result.current.hasWarnings).toBe(true);
    expect(result.current.highestSeverity).toBe("high");
  });

  it("extracts and merges source links from sources array and flags", () => {
    const detailData = {
      sources: [
        {
          url: "https://example.com/study1",
          label: "Study 1",
          evidence: "Clinically proven",
        },
      ],
      flags: [
        {
          ingredientName: "Alcohol",
          sourceUrl: "https://example.com/study2",
          description: "Drying agent",
        },
      ],
    };

    const { result } = renderHook(() => useProductDetailData(detailData));

    expect(result.current.sourceLinks).toHaveLength(2);
    expect(result.current.sourceLinks[0]).toEqual({
      url: "https://example.com/study1",
      label: "Study 1",
      evidence: "Clinically proven",
      publishedAt: "",
    });
    expect(result.current.sourceLinks[1]).toEqual({
      url: "https://example.com/study2",
      label: "Alcohol reference",
      evidence: "Drying agent",
      publishedAt: "",
    });
    expect(result.current.hasAnySourceEvidence).toBe(true);
  });

  it("normalizes image URLs and purchase links", () => {
    const detailData = {
      images: [
        "https://example.com/img1.jpg",
        { url: "https://example.com/img2.jpg" },
      ],
      product: {
        purchaseLinks: [
          { url: "https://store.example.com/buy", label: "Shop" },
        ],
        brandOfficialUrl: "https://brand.example.com",
      },
    };

    const { result } = renderHook(() => useProductDetailData(detailData));

    expect(result.current.imageUrls).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);

    expect(result.current.purchaseLinks).toEqual([
      { label: "Shop", url: "https://store.example.com/buy" },
      { label: "Official brand site", url: "https://brand.example.com" },
    ]);
  });

  it("returns explicit recommended products if passed in detailData", () => {
    const detailData = {
      recommendedProducts: [
        {
          id: "rec-1",
          name: "Gentle Cream",
          brandName: "Calm Brand",
          highestSeverity: "none",
        },
      ],
    };

    const { result } = renderHook(() => useProductDetailData(detailData));

    expect(result.current.recommendedItems).toHaveLength(1);
    expect(result.current.recommendedItems[0]).toEqual({
      id: "rec-1",
      slug: "rec-1",
      name: "Gentle Cream",
      brand: "Calm Brand",
      category: "",
      skin: "",
      highestSeverity: "none",
    });
  });

  it("falls back to generated recommended products based on product context", () => {
    const detailData = {
      product: {
        slug: "current-product",
        category: "Moisturizer",
        skin: "sensitive/dry",
      },
      flags: [{ severity: "high" }],
    };

    const { result } = renderHook(() => useProductDetailData(detailData));

    expect(result.current.recommendedItems.length).toBeGreaterThan(0);
    expect(
      result.current.recommendedItems.every(
        (item) => item.slug !== "current-product",
      ),
    ).toBe(true);
  });
});
