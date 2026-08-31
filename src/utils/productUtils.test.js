import { isSafeHttpUrl } from "./productUtils";

describe("productUtils", () => {
  describe("isSafeHttpUrl", () => {
    it("should return true for valid HTTP URLs", () => {
      expect(isSafeHttpUrl("http://example.com")).toBe(true);
    });

    it("should return true for valid HTTPS URLs", () => {
      expect(isSafeHttpUrl("https://example.com/path?query=1")).toBe(true);
    });

    it("should return false for falsy values", () => {
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
      expect(isSafeHttpUrl("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isSafeHttpUrl(123)).toBe(false);
      expect(isSafeHttpUrl({})).toBe(false);
      expect(isSafeHttpUrl([])).toBe(false);
    });

    it("should return false for unsupported protocols", () => {
      expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
      expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeHttpUrl("mailto:test@example.com")).toBe(false);
    });

    it("should return false for malformed URLs", () => {
      // This specifically tests the catch block since new URL("not-a-url") throws an error
      expect(isSafeHttpUrl("not-a-url")).toBe(false);
      // Another malformed URL example
      expect(isSafeHttpUrl("http://")).toBe(false);
    });
  });
});
