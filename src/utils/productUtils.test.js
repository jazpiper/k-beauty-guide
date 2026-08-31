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
  formatDate
} from "./productUtils";

describe("productUtils", () => {
  describe("isSafeHttpUrl", () => {
    it("returns true for valid http/https URLs", () => {
      expect(isSafeHttpUrl("http://example.com")).toBe(true);
      expect(isSafeHttpUrl("https://example.com")).toBe(true);
    });

    it("returns false for invalid or unsafe URLs", () => {
      expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
      expect(isSafeHttpUrl("not-a-url")).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
      expect(isSafeHttpUrl(123)).toBe(false);
    });
  });

  describe("sanitizeHttpUrl", () => {
    it("returns the URL if it is a safe http/https URL", () => {
      expect(sanitizeHttpUrl("http://example.com")).toBe("http://example.com");
      expect(sanitizeHttpUrl("https://example.com")).toBe("https://example.com");
    });

    it("returns an empty string for invalid or unsafe URLs", () => {
      expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeHttpUrl("ftp://example.com")).toBe("");
      expect(sanitizeHttpUrl("not-a-url")).toBe("");
      expect(sanitizeHttpUrl(null)).toBe("");
    });
  });

  describe("asArray", () => {
    it("returns an array from a single value", () => {
      expect(asArray("test")).toEqual(["test"]);
      expect(asArray(123)).toEqual([123]);
    });

    it("returns the same array if an array is provided", () => {
      expect(asArray(["test", "another"])).toEqual(["test", "another"]);
    });

    it("filters out falsy values", () => {
      expect(asArray(["test", null, "", undefined, false, 0, "another"])).toEqual(["test", "another"]);
      expect(asArray(null)).toEqual([]);
    });

    it("returns empty array for falsy values", () => {
      expect(asArray(undefined)).toEqual([]);
      expect(asArray("")).toEqual([]);
    });
  });

  describe("normalizeImage", () => {
    it("returns null for falsy values", () => {
      expect(normalizeImage(null)).toBeNull();
      expect(normalizeImage(undefined)).toBeNull();
    });

    it("returns the string if a string is provided", () => {
      expect(normalizeImage("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
    });

    it("extracts url from an object", () => {
      expect(normalizeImage({ url: "https://example.com/image1.jpg" })).toBe("https://example.com/image1.jpg");
      expect(normalizeImage({ src: "https://example.com/image2.jpg" })).toBe("https://example.com/image2.jpg");
      expect(normalizeImage({ imageUrl: "https://example.com/image3.jpg" })).toBe("https://example.com/image3.jpg");
      expect(normalizeImage({ publicUrl: "https://example.com/image4.jpg" })).toBe("https://example.com/image4.jpg");
    });

    it("returns null if no valid property is found in the object", () => {
      expect(normalizeImage({ someOtherProp: "value" })).toBeNull();
    });
  });

  describe("normalizeSourceLink", () => {
    it("returns null for falsy values", () => {
      expect(normalizeSourceLink(null)).toBeNull();
      expect(normalizeSourceLink(undefined)).toBeNull();
    });

    it("normalizes a string URL", () => {
      expect(normalizeSourceLink("https://example.com")).toEqual({
        url: "https://example.com",
        label: "example.com",
        evidence: "",
        publishedAt: ""
      });
      expect(normalizeSourceLink("https://www.example.com")).toEqual({
        url: "https://www.example.com",
        label: "example.com",
        evidence: "",
        publishedAt: ""
      });
    });

    it("normalizes an object with url and label", () => {
      expect(normalizeSourceLink({ url: "https://example.com", label: "Example Site" })).toEqual({
        url: "https://example.com",
        label: "Example Site",
        evidence: "",
        publishedAt: undefined
      });
    });

    it("normalizes an object using fallback properties", () => {
      expect(normalizeSourceLink({
        href: "https://example.com",
        title: "Example Title",
        description: "Some evidence",
        date: "2023-01-01"
      })).toEqual({
        url: "https://example.com",
        label: "Example Title",
        evidence: "Some evidence",
        publishedAt: "2023-01-01"
      });
    });

    it("returns empty url for unsafe URLs", () => {
      expect(normalizeSourceLink("javascript:alert(1)")).toEqual({
        url: "",
        label: "Source",
        evidence: "",
        publishedAt: ""
      });
    });
  });

  describe("normalizePurchaseLink", () => {
    it("returns null for falsy values", () => {
      expect(normalizePurchaseLink(null)).toBeNull();
    });

    it("normalizes a string URL", () => {
      expect(normalizePurchaseLink("https://example.com/buy")).toEqual({
        label: "Buy now",
        url: "https://example.com/buy",
      });
    });

    it("returns null for unsafe string URLs", () => {
      expect(normalizePurchaseLink("javascript:alert(1)")).toBeNull();
    });

    it("normalizes an object with url/href/link and label/name", () => {
      expect(normalizePurchaseLink({ url: "https://example.com/buy", label: "Store" })).toEqual({
        label: "Store",
        url: "https://example.com/buy",
      });
      expect(normalizePurchaseLink({ href: "https://example.com/buy2", name: "Shop" })).toEqual({
        label: "Shop",
        url: "https://example.com/buy2",
      });
      expect(normalizePurchaseLink({ link: "https://example.com/buy3" })).toEqual({
        label: "Buy now",
        url: "https://example.com/buy3",
      });
    });

    it("returns null for unsafe object URLs", () => {
      expect(normalizePurchaseLink({ url: "javascript:alert(1)" })).toBeNull();
    });
  });

  describe("normalizeRecommendedProduct", () => {
    it("returns null for falsy values", () => {
      expect(normalizeRecommendedProduct(null)).toBeNull();
    });

    it("normalizes item to recommended product format", () => {
      expect(normalizeRecommendedProduct({
        id: "123",
        slug: "cool-product",
        name: "Cool Product",
        brandName: "Cool Brand",
        category: "Skincare",
        skin: "Dry",
        highestSeverity: "high",
      })).toEqual({
        id: "123",
        slug: "cool-product",
        name: "Cool Product",
        brand: "Cool Brand",
        category: "Skincare",
        skin: "Dry",
        highestSeverity: "high",
      });
    });

    it("applies fallbacks for missing values", () => {
      expect(normalizeRecommendedProduct({
        name: "Minimal Product",
      })).toEqual({
        id: "Minimal Product",
        slug: undefined,
        name: "Minimal Product",
        brand: "K-Beauty",
        category: "",
        skin: "",
        highestSeverity: "none",
      });
    });
  });

  describe("mergeUniqueLinks", () => {
    it("returns unique links based on url", () => {
      const links = [
        { url: "https://example.com/1", label: "Link 1" },
        { url: "https://example.com/1", label: "Link 1 duplicate" },
        { url: "https://example.com/2", label: "Link 2" },
      ];
      expect(mergeUniqueLinks(links)).toEqual([
        { url: "https://example.com/1", label: "Link 1" },
        { url: "https://example.com/2", label: "Link 2" },
      ]);
    });

    it("returns unique links based on label if url is missing", () => {
      const links = [
        { label: "Duplicate Label" },
        { label: "duplicate label" },
        { label: "Unique Label" },
      ];
      expect(mergeUniqueLinks(links)).toEqual([
        { label: "Duplicate Label" },
        { label: "Unique Label" },
      ]);
    });
  });

  describe("getSearchUrl", () => {
    it("returns empty string if neither name nor brand is provided", () => {
      expect(getSearchUrl(null)).toBe("");
      expect(getSearchUrl({})).toBe("");
    });

    it("returns a search URL based on brand and name", () => {
      expect(getSearchUrl({ brand: "BrandA", name: "ProductB" })).toBe("https://www.google.com/search?q=BrandA%20ProductB");
    });

    it("returns a search URL if only name is provided", () => {
      expect(getSearchUrl({ name: "ProductB" })).toBe("https://www.google.com/search?q=ProductB");
    });

    it("returns a search URL if only brand is provided", () => {
      expect(getSearchUrl({ brand: "BrandA" })).toBe("https://www.google.com/search?q=BrandA");
    });
  });

  describe("normalizeSeverity", () => {
    it("returns 'none' for falsy values", () => {
      expect(normalizeSeverity(null)).toBe("none");
      expect(normalizeSeverity(undefined)).toBe("none");
      expect(normalizeSeverity("")).toBe("none");
    });

    it("returns lowercase string representation of the value", () => {
      expect(normalizeSeverity("HIGH")).toBe("high");
      expect(normalizeSeverity("Low")).toBe("low");
    });
  });

  describe("getSeverityLabel", () => {
    it("returns 'No flags' for 'none' or falsy values", () => {
      expect(getSeverityLabel(null)).toBe("No flags");
      expect(getSeverityLabel("none")).toBe("No flags");
    });

    it("returns 'Avoid if sensitive' for 'avoid_if_sensitive'", () => {
      expect(getSeverityLabel("avoid_if_sensitive")).toBe("Avoid if sensitive");
    });

    it("formats other severity strings correctly (capitalized, underscores to spaces)", () => {
      expect(getSeverityLabel("high_risk")).toBe("High Risk");
      expect(getSeverityLabel("low")).toBe("Low");
    });
  });

  describe("getHighestSeverity", () => {
    it("returns product highest severity if available", () => {
      expect(getHighestSeverity({ highestSeverity: "high" }, null, null)).toBe("high");
    });

    it("calculates highest severity from flags and ingredients if product highest severity is not available", () => {
      const flags = [{ severity: "low" }, { severity: "medium" }];
      const ingredients = [{ highestSeverity: "high" }, { safety: "low" }];
      expect(getHighestSeverity({}, flags, ingredients)).toBe("high");
    });

    it("calculates highest severity when only flags are available", () => {
      const flags = [{ severity: "low" }, { severity: "medium" }];
      expect(getHighestSeverity({}, flags, null)).toBe("medium");
    });

    it("returns 'none' if no severities are found", () => {
      expect(getHighestSeverity({}, [], [])).toBe("none");
      expect(getHighestSeverity(null, null, null)).toBe("none");
    });
  });

  describe("formatPrice", () => {
    it("returns empty string if product is falsy", () => {
      expect(formatPrice(null)).toBe("");
    });

    it("returns string price directly", () => {
      expect(formatPrice({ price: "Free" })).toBe("Free");
    });

    it("formats KRW price correctly", () => {
      expect(formatPrice({ priceKrw: 15000 })).toBe("₩15,000");
      expect(formatPrice({ priceKrw: "15,000 won" })).toBe("₩15,000");
    });

    it("falls back to string if KRW price is not finite", () => {
      expect(formatPrice({ priceKrw: "abc" })).toBe("₩0");
    });

    it("formats price with currency correctly", () => {
      expect(formatPrice({ price: 15.5, currency: "USD" })).toBe("$15.50");
    });

    it("falls back to string if price is not finite with currency", () => {
      expect(formatPrice({ price: "abc", currency: "USD" })).toBe("abc");
    });

    it("returns string price if only price is provided", () => {
      expect(formatPrice({ price: 15.5 })).toBe("15.5");
    });
  });

  describe("formatDate", () => {
    it("returns empty string for falsy values", () => {
      expect(formatDate(null)).toBe("");
      expect(formatDate(undefined)).toBe("");
      expect(formatDate("")).toBe("");
    });

    it("formats a valid date string", () => {
      expect(formatDate("2023-01-15T00:00:00Z")).toBe("Jan 15, 2023");
    });

    it("returns empty string for an invalid date string", () => {
      expect(formatDate("invalid-date")).toBe("");
    });
  });
});
