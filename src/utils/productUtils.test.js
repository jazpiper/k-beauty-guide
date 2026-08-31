import { formatPrice } from "./productUtils";

describe("formatPrice", () => {
  it("returns empty string if product is falsy", () => {
    expect(formatPrice(null)).toBe("");
    expect(formatPrice(undefined)).toBe("");
  });

  it("returns price string as-is if price is a string", () => {
    expect(formatPrice({ price: "$20.00" })).toBe("$20.00");
    expect(formatPrice({ price: "Free" })).toBe("Free");
  });

  it("formats priceKrw to Korean Won", () => {
    expect(formatPrice({ priceKrw: 15000 })).toBe("₩15,000");
    expect(formatPrice({ priceKrw: "15,000" })).toBe("₩15,000");
    expect(formatPrice({ priceKrw: "15000원" })).toBe("₩15,000");
  });

  it("returns original priceKrw if it cannot be parsed as a valid number", () => {
    expect(formatPrice({ priceKrw: ".." })).toBe("..");
  });

  it("formats numeric price with currency using Intl.NumberFormat", () => {
    expect(formatPrice({ price: 15, currency: "USD" })).toBe("$15.00");
    expect(formatPrice({ price: 20.5, currency: "EUR" })).toBe("€20.50");
  });

  it("returns unformatted price with currency if price is not a finite number but is truthy", () => {
    // We want Number(product.price) to be NaN but product.price to be truthy
    // However, if product.price is a string, it returns early at line 98.
    // So product.price must be an object or NaN.
    // If it's NaN, `product.price` is falsy, so it skips the block.
    // If it's an object like {}, Number({}) is NaN.
    expect(formatPrice({ price: {}, currency: "USD" })).toBe("USD [object Object]");
  });

  it("returns stringified price if only numeric price is provided", () => {
    expect(formatPrice({ price: 30 })).toBe("30");
  });

  it("returns empty string if product has no price fields", () => {
    expect(formatPrice({})).toBe("");
    expect(formatPrice({ name: "Cream" })).toBe("");
  });
});
