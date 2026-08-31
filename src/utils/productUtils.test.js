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

describe("productUtils", () => {
  describe("isSafeHttpUrl", () => {
    it("returns true for valid http/https URLs", () => {
      expect(isSafeHttpUrl("http://example.com")).toBe(true);
      expect(isSafeHttpUrl("https://example.com")).toBe(true);
    });

    it("returns false for invalid or non-http/https URLs", () => {
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
    it("returns the URL if it is a safe http/https URL", () => {
      expect(sanitizeHttpUrl("https://example.com")).toBe("https://example.com");
    });

    it("returns an empty string if it is not a safe http/https URL", () => {
      expect(sanitizeHttpUrl("ftp://example.com")).toBe("");
      expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeHttpUrl("")).toBe("");
      expect(sanitizeHttpUrl(null)).toBe("");
    });
  });

  describe("asArray", () => {
    it("returns an empty array for falsy values", () => {
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined)).toEqual([]);
      expect(asArray(false)).toEqual([]);
      expect(asArray("")).toEqual([]);
    });

    it("returns a filtered array when an array is passed", () => {
      expect(asArray([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
    });

    it("returns an array with the single truthy element when a non-array is passed", () => {
      expect(asArray("test")).toEqual(["test"]);
      expect(asArray(123)).toEqual([123]);
    });
  });

  describe("normalizeImage", () => {
    it("returns null for falsy values", () => {
      expect(normalizeImage(null)).toBe(null);
      expect(normalizeImage(undefined)).toBe(null);
    });

    it("returns the string if a string is passed", () => {
      expect(normalizeImage("image.png")).toBe("image.png");
    });

    it("returns the correct property from an object", () => {
      expect(normalizeImage({ url: "url.png" })).toBe("url.png");
      expect(normalizeImage({ src: "src.png" })).toBe("src.png");
      expect(normalizeImage({ imageUrl: "imageUrl.png" })).toBe("imageUrl.png");
      expect(normalizeImage({ publicUrl: "publicUrl.png" })).toBe("publicUrl.png");
    });

    it("returns null if no valid property is found in object", () => {
      expect(normalizeImage({ other: "other.png" })).toBe(null);
    });
  });

  describe("normalizeSourceLink", () => {
    it("returns null for falsy values", () => {
      expect(normalizeSourceLink(null)).toBe(null);
    });

    it("normalizes a string URL", () => {
      expect(normalizeSourceLink("https://example.com")).toEqual({
        url: "https://example.com",
        label: "example.com",
        evidence: "",
        publishedAt: "",
      });

      expect(normalizeSourceLink("https://www.example.com")).toEqual({
        url: "https://www.example.com",
        label: "example.com",
        evidence: "",
        publishedAt: "",
      });
    });

    it("normalizes an object source link", () => {
      expect(normalizeSourceLink({
        url: "https://example.com",
        label: "Custom Label",
        evidence: "Some evidence",
        publishedAt: "2023-01-01"
      })).toEqual({
        url: "https://example.com",
        label: "Custom Label",
        evidence: "Some evidence",
        publishedAt: "2023-01-01"
      });
    });

    it("extracts hostname as label if label is not provided in object", () => {
      expect(normalizeSourceLink({
        url: "https://www.test.com",
      })).toEqual({
        url: "https://www.test.com",
        label: "test.com",
        evidence: "",
        publishedAt: undefined,
      });
    });

    it("handles invalid urls gracefully", () => {
      expect(normalizeSourceLink("not-a-url")).toEqual({
        url: "",
        label: "Source",
        evidence: "",
        publishedAt: "",
      });
    });
  });

  describe("normalizePurchaseLink", () => {
    it("returns null for falsy values", () => {
      expect(normalizePurchaseLink(null)).toBe(null);
    });

    it("normalizes a string URL", () => {
      expect(normalizePurchaseLink("https://store.com/buy")).toEqual({
        label: "Buy now",
        url: "https://store.com/buy",
      });
    });

    it("returns null for an invalid string URL", () => {
      expect(normalizePurchaseLink("invalid-url")).toBe(null);
    });

    it("normalizes an object with url and label", () => {
      expect(normalizePurchaseLink({
        url: "https://store.com/buy",
        label: "Shop here",
      })).toEqual({
        label: "Shop here",
        url: "https://store.com/buy",
      });
    });

    it("returns null for object with invalid URL", () => {
      expect(normalizePurchaseLink({ url: "invalid" })).toBe(null);
    });
  });

  describe("normalizeRecommendedProduct", () => {
    it("returns null for falsy values", () => {
      expect(normalizeRecommendedProduct(null)).toBe(null);
    });

    it("normalizes a recommended product object", () => {
      expect(normalizeRecommendedProduct({
        id: "prod-1",
        slug: "product-1",
        name: "Test Product",
        brandName: "Test Brand",
        category: "Skincare",
        skin: "Oily",
        highestSeverity: "HIGH",
      })).toEqual({
        id: "prod-1",
        slug: "product-1",
        name: "Test Product",
        brand: "Test Brand",
        category: "Skincare",
        skin: "Oily",
        highestSeverity: "high",
      });
    });

    it("applies defaults for missing fields", () => {
      expect(normalizeRecommendedProduct({ id: "prod-1" })).toEqual({
        id: "prod-1",
        slug: "prod-1",
        name: "Recommended product",
        brand: "K-Beauty",
        category: "",
        skin: "",
        highestSeverity: "none",
      });
    });
  });

  describe("mergeUniqueLinks", () => {
    it("removes duplicate links based on url", () => {
      const links = [
        { url: "https://a.com", label: "A" },
        { url: "https://a.com", label: "B" },
        { url: "https://b.com", label: "A" },
      ];
      expect(mergeUniqueLinks(links)).toEqual([
        { url: "https://a.com", label: "A" },
        { url: "https://b.com", label: "A" },
      ]);
    });

    it("removes duplicate links based on lowercase label if url is missing", () => {
      const links = [
        { label: "Link 1" },
        { label: "link 1" },
        { label: "Link 2" },
      ];
      expect(mergeUniqueLinks(links)).toEqual([
        { label: "Link 1" },
        { label: "Link 2" },
      ]);
    });
  });

  describe("getSearchUrl", () => {
    it("returns empty string if product has no name and brand", () => {
      expect(getSearchUrl(null)).toBe("");
      expect(getSearchUrl({})).toBe("");
    });

    it("returns a google search URL for product with name and brand", () => {
      expect(getSearchUrl({ name: "Toner", brand: "Brand X" })).toBe(
        "https://www.google.com/search?q=Brand%20X%20Toner"
      );
    });

    it("returns a google search URL for product with only name", () => {
      expect(getSearchUrl({ name: "Toner" })).toBe(
        "https://www.google.com/search?q=Toner"
      );
    });

    it("returns a google search URL for product with only brand", () => {
      expect(getSearchUrl({ brand: "Brand X" })).toBe(
        "https://www.google.com/search?q=Brand%20X"
      );
    });
  });

  describe("normalizeSeverity", () => {
    it("returns 'none' for falsy values", () => {
      expect(normalizeSeverity(null)).toBe("none");
      expect(normalizeSeverity("")).toBe("none");
    });

    it("returns lowercased string of value", () => {
      expect(normalizeSeverity("HIGH")).toBe("high");
      expect(normalizeSeverity("Medium_Risk")).toBe("medium_risk");
    });
  });

  describe("getSeverityLabel", () => {
    it("returns 'No flags' for 'none' or falsy", () => {
      expect(getSeverityLabel("none")).toBe("No flags");
      expect(getSeverityLabel("")).toBe("No flags");
    });

    it("returns 'Avoid if sensitive' for 'avoid_if_sensitive'", () => {
      expect(getSeverityLabel("avoid_if_sensitive")).toBe("Avoid if sensitive");
    });

    it("formats other severities properly", () => {
      expect(getSeverityLabel("high_risk")).toBe("High Risk");
      expect(getSeverityLabel("medium")).toBe("Medium");
    });
  });

  describe("getHighestSeverity", () => {
    it("returns product highestSeverity if present", () => {
      expect(getHighestSeverity({ highestSeverity: "MEDIUM" })).toBe("medium");
    });

    it("calculates highest severity from flags and ingredients", () => {
      const flags = [{ severity: "low" }, { severity: "high" }];
      const ingredients = [{ highestSeverity: "medium" }, { safety: "caution" }];
      expect(getHighestSeverity({}, flags, ingredients)).toBe("high");
    });

    it("returns 'none' if no severities found", () => {
      expect(getHighestSeverity({}, [], [])).toBe("none");
    });

    it("handles falsy flag or ingredient items", () => {
      const flags = [null, { severity: "low" }];
      const ingredients = [undefined, {}];
      expect(getHighestSeverity({}, flags, ingredients)).toBe("low");
    });
  });

  describe("formatPrice", () => {
    it("returns empty string for falsy product", () => {
      expect(formatPrice(null)).toBe("");
    });

    it("returns string price directly", () => {
      expect(formatPrice({ price: "Contact for price" })).toBe("Contact for price");
    });

    it("formats priceKrw", () => {
      expect(formatPrice({ priceKrw: 15000 })).toBe("₩15,000");
      expect(formatPrice({ priceKrw: "15,000 won" })).toBe("₩15,000");
      expect(formatPrice({ priceKrw: "invalid" })).toBe("₩0");
    });

    it("formats price and currency", () => {
      expect(formatPrice({ price: 25.5, currency: "USD" })).toBe("$25.50");
      expect(formatPrice({ price: 25.5, currency: "EUR" })).toBe("€25.50");
    });

    it("formats price and currency fallback", () => {
      expect(formatPrice({ price: "NaN", currency: "USD" })).toBe("NaN");
    });

    it("returns stringified price if no currency", () => {
      expect(formatPrice({ price: 100 })).toBe("100");
    });
  });

  describe("formatDate", () => {
    it("returns empty string for falsy values", () => {
      expect(formatDate(null)).toBe("");
      expect(formatDate("")).toBe("");
    });

    it("formats valid date strings", () => {
      expect(formatDate("2023-01-15T12:00:00Z")).toBe("Jan 15, 2023");
    });

    it("returns empty string for invalid date strings", () => {
      expect(formatDate("invalid-date")).toBe("");
    });
  });
});
