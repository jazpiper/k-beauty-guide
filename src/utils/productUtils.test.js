import {
  isSafeHttpUrl,
  sanitizeHttpUrl,
  asArray,
  normalizeImage,
  normalizeSourceLink,
  normalizePurchaseLink,
  normalizeRecommendedProduct,
  mergeUniqueLinks,
  getSearchUrl,
  normalizeSeverity,
  getSeverityLabel,
  getHighestSeverity,
  formatPrice,
  formatDate,
} from "./productUtils";

describe("productUtils - URL utilities", () => {
  describe("isSafeHttpUrl", () => {
    it("returns true for valid http and https URLs", () => {
      expect(isSafeHttpUrl("http://example.com")).toBe(true);
      expect(isSafeHttpUrl("https://example.com/path?query=1")).toBe(true);
    });

    it("returns false for invalid or non-http(s) URLs", () => {
      expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
      expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeHttpUrl("not-a-url")).toBe(false);
      expect(isSafeHttpUrl("")).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
      expect(isSafeHttpUrl(123)).toBe(false);
    });
  });

  describe("sanitizeHttpUrl", () => {
    it("returns the URL if safe", () => {
      expect(sanitizeHttpUrl("https://example.com")).toBe(
        "https://example.com",
      );
      expect(sanitizeHttpUrl("http://example.com/test")).toBe(
        "http://example.com/test",
      );
    });

    it("returns an empty string if unsafe or invalid", () => {
      expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeHttpUrl("invalid")).toBe("");
      expect(sanitizeHttpUrl(null)).toBe("");
    });
  });

  describe("getSearchUrl", () => {
    it("returns empty string if neither brand nor name is present", () => {
      expect(getSearchUrl(null)).toBe("");
      expect(getSearchUrl({})).toBe("");
      expect(getSearchUrl({ brand: "", name: "" })).toBe("");
    });

    it("generates safe Google search URL for product with brand and/or name", () => {
      expect(getSearchUrl({ brand: "COSRX", name: "Snail Essence" })).toBe(
        "https://www.google.com/search?q=COSRX%20Snail%20Essence",
      );
      expect(getSearchUrl({ name: "Cleanser" })).toBe(
        "https://www.google.com/search?q=Cleanser",
      );
      expect(getSearchUrl({ brand: "Innisfree" })).toBe(
        "https://www.google.com/search?q=Innisfree",
      );
    });
  });
});

describe("productUtils - Collection & Image utilities", () => {
  describe("asArray", () => {
    it("returns an empty array for falsy values", () => {
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined)).toEqual([]);
      expect(asArray("")).toEqual([]);
      expect(asArray(false)).toEqual([]);
    });

    it("filters out falsy values from an array", () => {
      expect(asArray(["a", null, "b", undefined, false, 0, "c"])).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    it("wraps single truthy non-array values into an array", () => {
      expect(asArray("item")).toEqual(["item"]);
      expect(asArray({ key: "val" })).toEqual([{ key: "val" }]);
    });
  });

  describe("normalizeImage", () => {
    it("returns null for falsy values", () => {
      expect(normalizeImage(null)).toBeNull();
      expect(normalizeImage(undefined)).toBeNull();
      expect(normalizeImage("")).toBeNull();
    });

    it("returns string as is", () => {
      expect(normalizeImage("https://example.com/img.png")).toBe(
        "https://example.com/img.png",
      );
    });

    it("extracts image URL property in order of fallback precedence (url > src > imageUrl > publicUrl)", () => {
      expect(normalizeImage({ url: "https://example.com/url.jpg" })).toBe(
        "https://example.com/url.jpg",
      );
      expect(normalizeImage({ src: "https://example.com/src.jpg" })).toBe(
        "https://example.com/src.jpg",
      );
      expect(normalizeImage({ imageUrl: "https://example.com/img.jpg" })).toBe(
        "https://example.com/img.jpg",
      );
      expect(
        normalizeImage({ publicUrl: "https://example.com/public.jpg" }),
      ).toBe("https://example.com/public.jpg");
      expect(normalizeImage({ src: "src.jpg", imageUrl: "img.jpg" })).toBe(
        "src.jpg",
      );
    });

    it("returns null if object contains none of the image URL properties", () => {
      expect(normalizeImage({ other: "val" })).toBeNull();
    });
  });

  describe("normalizeSourceLink", () => {
    it("returns null for falsy input", () => {
      expect(normalizeSourceLink(null)).toBeNull();
      expect(normalizeSourceLink(undefined)).toBeNull();
    });

    it("normalizes a string URL", () => {
      expect(normalizeSourceLink("https://www.example.com/article")).toEqual({
        url: "https://www.example.com/article",
        label: "example.com",
        evidence: "",
        publishedAt: "",
      });
    });

    it("normalizes an object with url, label, evidence, and publishedAt", () => {
      expect(
        normalizeSourceLink({
          url: "https://example.com/study",
          label: "Custom Label",
          evidence: "High level of evidence",
          publishedAt: "2023-01-01",
        }),
      ).toEqual({
        url: "https://example.com/study",
        label: "Custom Label",
        evidence: "High level of evidence",
        publishedAt: "2023-01-01",
      });
    });

    it("falls back to property aliases when normalizing object source", () => {
      expect(
        normalizeSourceLink({
          href: "https://test.com/paper",
          title: "Study Title",
          description: "Description text",
          date: "2022-05-10",
        }),
      ).toEqual({
        url: "https://test.com/paper",
        label: "Study Title",
        evidence: "Description text",
        publishedAt: "2022-05-10",
      });

      expect(
        normalizeSourceLink({
          sourceUrl: "https://demo.com",
          name: "Demo Name",
        }),
      ).toEqual({
        url: "https://demo.com",
        label: "Demo Name",
        evidence: "",
        publishedAt: undefined,
      });
    });

    it("handles invalid URL string gracefully with default label fallback", () => {
      expect(normalizeSourceLink("not-a-valid-url")).toEqual({
        url: "",
        label: "Source",
        evidence: "",
        publishedAt: "",
      });
    });
  });

  describe("normalizePurchaseLink", () => {
    it("returns null for falsy input or unsafe URL", () => {
      expect(normalizePurchaseLink(null)).toBeNull();
      expect(normalizePurchaseLink("invalid-url")).toBeNull();
      expect(normalizePurchaseLink({ url: "javascript:void(0)" })).toBeNull();
    });

    it("normalizes string URL input", () => {
      expect(normalizePurchaseLink("https://store.com/buy")).toEqual({
        label: "Buy now",
        url: "https://store.com/buy",
      });
    });

    it("normalizes object input with custom or fallback label", () => {
      expect(
        normalizePurchaseLink({
          url: "https://store.com/item",
          label: "Shop Here",
        }),
      ).toEqual({
        label: "Shop Here",
        url: "https://store.com/item",
      });

      expect(
        normalizePurchaseLink({
          href: "https://store.com/item2",
          name: "Official Store",
        }),
      ).toEqual({
        label: "Official Store",
        url: "https://store.com/item2",
      });

      expect(
        normalizePurchaseLink({
          link: "https://store.com/item3",
        }),
      ).toEqual({
        label: "Buy now",
        url: "https://store.com/item3",
      });
    });
  });

  describe("normalizeRecommendedProduct", () => {
    it("returns null for falsy input", () => {
      expect(normalizeRecommendedProduct(null)).toBeNull();
      expect(normalizeRecommendedProduct(undefined)).toBeNull();
    });

    it("normalizes item object with fallbacks", () => {
      expect(
        normalizeRecommendedProduct({
          id: "prod-1",
          slug: "prod-1-slug",
          name: "Moisturizer",
          brandName: "Brand X",
          category: "Cream",
          skin: "Dry",
          highestSeverity: "CAUTION",
        }),
      ).toEqual({
        id: "prod-1",
        slug: "prod-1-slug",
        name: "Moisturizer",
        brand: "Brand X",
        category: "Cream",
        skin: "Dry",
        highestSeverity: "caution",
      });
    });

    it("uses appropriate field fallbacks when properties are missing", () => {
      expect(
        normalizeRecommendedProduct({
          name: "Sunscreen",
          brand: "Brand Y",
        }),
      ).toEqual({
        id: "Sunscreen",
        slug: undefined,
        name: "Sunscreen",
        brand: "Brand Y",
        category: "",
        skin: "",
        highestSeverity: "none",
      });

      expect(normalizeRecommendedProduct({})).toEqual({
        id: undefined,
        slug: undefined,
        name: "Recommended product",
        brand: "K-Beauty",
        category: "",
        skin: "",
        highestSeverity: "none",
      });
    });
  });

  describe("mergeUniqueLinks", () => {
    it("deduplicates links based on url or lowercase label", () => {
      const links = [
        { url: "https://example.com/1", label: "Link 1" },
        { url: "https://example.com/1", label: "Duplicate URL Link" },
        { url: "", label: "Same Label" },
        { url: "", label: "SAME LABEL" },
        { url: "https://example.com/2", label: "Unique Link" },
      ];

      expect(mergeUniqueLinks(links)).toEqual([
        { url: "https://example.com/1", label: "Link 1" },
        { url: "", label: "Same Label" },
        { url: "https://example.com/2", label: "Unique Link" },
      ]);
    });
  });
});

describe("productUtils - Severity & Formatting utilities", () => {
  describe("normalizeSeverity", () => {
    it("returns 'none' for falsy values", () => {
      expect(normalizeSeverity(null)).toBe("none");
      expect(normalizeSeverity(undefined)).toBe("none");
      expect(normalizeSeverity("")).toBe("none");
    });

    it("converts severity strings to lowercase", () => {
      expect(normalizeSeverity("HIGH")).toBe("high");
      expect(normalizeSeverity("Avoid_If_Sensitive")).toBe(
        "avoid_if_sensitive",
      );
    });
  });

  describe("getSeverityLabel", () => {
    it("formats severity strings into human-readable labels", () => {
      expect(getSeverityLabel(null)).toBe("No flags");
      expect(getSeverityLabel("none")).toBe("No flags");
      expect(getSeverityLabel("avoid_if_sensitive")).toBe("Avoid if sensitive");
      expect(getSeverityLabel("restricted")).toBe("Restricted");
      expect(getSeverityLabel("high_risk")).toBe("High Risk");
    });
  });

  describe("getHighestSeverity", () => {
    it("returns product's own highestSeverity if present", () => {
      expect(getHighestSeverity({ highestSeverity: "RESTRICTED" })).toBe(
        "restricted",
      );
    });

    it("calculates highest severity from flags and ingredients when product highestSeverity is absent", () => {
      const flags = [{ severity: "caution" }, { severity: "high" }];
      const ingredients = [
        { highestSeverity: "medium" },
        { safety: "restricted" },
      ];

      expect(getHighestSeverity({}, flags, ingredients)).toBe("restricted");
    });

    it("defaults to 'none' if no valid severities are provided", () => {
      expect(getHighestSeverity(null, [], [])).toBe("none");
      expect(getHighestSeverity({}, null, null)).toBe("none");
    });
  });

  describe("formatPrice", () => {
    it("returns empty string for falsy input", () => {
      expect(formatPrice(null)).toBe("");
      expect(formatPrice(undefined)).toBe("");
    });

    it("returns string price directly if product.price is a string", () => {
      expect(formatPrice({ price: "$25.00" })).toBe("$25.00");
    });

    it("formats priceKrw with KRW locale currency symbol when numeric or numeric string", () => {
      expect(formatPrice({ priceKrw: 15000 })).toBe("₩15,000");
      expect(formatPrice({ priceKrw: "20,000 KRW" })).toBe("₩20,000");
    });

    it("formats numeric price and currency using Intl.NumberFormat", () => {
      expect(formatPrice({ price: 19.99, currency: "USD" })).toBe("$19.99");
    });

    it("returns string price directly if product.price is string, even with currency", () => {
      expect(formatPrice({ price: "19.99", currency: "USD" })).toBe("19.99");
    });

    it("returns price string representation if only numeric price exists", () => {
      expect(formatPrice({ price: 30 })).toBe("30");
    });
  });

  describe("formatDate", () => {
    it("returns empty string for falsy or invalid dates", () => {
      expect(formatDate(null)).toBe("");
      expect(formatDate("invalid-date")).toBe("");
    });

    it("formats valid dates into short month, numeric day, and numeric year format", () => {
      const formatted = formatDate("2023-11-15T00:00:00Z");
      expect(formatted).toMatch(/Nov 15, 2023/);
    });
  });
});
