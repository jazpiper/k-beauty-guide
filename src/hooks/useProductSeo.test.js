import { renderHook } from "@testing-library/react";
import { useProductSeo } from "./useProductSeo";

describe("useProductSeo", () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = "Default Title";
    const existingMeta = document.querySelector('meta[name="description"]');
    if (existingMeta) {
      existingMeta.remove();
    }
  });

  afterEach(() => {
    document.title = originalTitle;
    const existingMeta = document.querySelector('meta[name="description"]');
    if (existingMeta) {
      existingMeta.remove();
    }
  });

  it("does nothing when product is null or undefined", () => {
    const { unmount } = renderHook(() => useProductSeo(null, 0));

    expect(document.title).toBe("Default Title");
    expect(document.querySelector('meta[name="description"]')).toBeNull();

    unmount();
    expect(document.title).toBe("Default Title");
  });

  it("sets document.title and creates meta description when product is provided", () => {
    const product = {
      name: "Hydrating Toner",
      category: "Toner",
      skin: "Sensitive",
      description: "A deep hydration formula.",
    };

    const { unmount } = renderHook(() => useProductSeo(product, 2));

    expect(document.title).toBe("Hydrating Toner | K-Beauty Guide");
    const metaTag = document.querySelector('meta[name="description"]');
    expect(metaTag).not.toBeNull();
    expect(metaTag.getAttribute("content")).toBe(
      "Hydrating Toner • Toner • Sensitive • Safety notes: 2 • A deep hydration formula.",
    );

    unmount();
    expect(document.title).toBe("Default Title");
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });

  it("updates existing meta tag and restores original content on unmount", () => {
    const initialMeta = document.createElement("meta");
    initialMeta.setAttribute("name", "description");
    initialMeta.setAttribute("content", "Initial meta description");
    document.head.appendChild(initialMeta);

    const product = {
      name: "Centella Cream",
      category: "Cream",
      skin: "All skin types",
      description: "Soothing cream for irritation.",
    };

    const { unmount } = renderHook(() => useProductSeo(product, 0));

    const metaTag = document.querySelector('meta[name="description"]');
    expect(metaTag).not.toBeNull();
    expect(metaTag.getAttribute("content")).toBe(
      "Centella Cream • Cream • All skin types • Safety notes: 0 • Soothing cream for irritation.",
    );

    unmount();
    expect(document.title).toBe("Default Title");
    expect(document.querySelector('meta[name="description"]')).not.toBeNull();
    expect(
      document
        .querySelector('meta[name="description"]')
        .getAttribute("content"),
    ).toBe("Initial meta description");
  });

  it("updates title and meta description when product or flagCount changes", () => {
    const initialProduct = {
      name: "Product A",
      category: "Essence",
      skin: "Dry",
      description: "Essence description",
    };

    const { rerender } = renderHook(
      ({ product, flagCount }) => useProductSeo(product, flagCount),
      { initialProps: { product: initialProduct, flagCount: 1 } },
    );

    expect(document.title).toBe("Product A | K-Beauty Guide");
    let metaTag = document.querySelector('meta[name="description"]');
    expect(metaTag.getAttribute("content")).toBe(
      "Product A • Essence • Dry • Safety notes: 1 • Essence description",
    );

    const updatedProduct = {
      name: "Product B",
      category: "Serum",
      skin: "Oily",
      description: "Serum description",
    };

    rerender({ product: updatedProduct, flagCount: 3 });

    expect(document.title).toBe("Product B | K-Beauty Guide");
    metaTag = document.querySelector('meta[name="description"]');
    expect(metaTag.getAttribute("content")).toBe(
      "Product B • Serum • Oily • Safety notes: 3 • Serum description",
    );
  });

  it("truncates meta description to 155 characters", () => {
    const product = {
      name: "Very Long Product Name ".repeat(3),
      category: "Very Long Category Name ".repeat(3),
      skin: "Very Long Skin Type ".repeat(3),
      description: "Very Long Product Description ".repeat(5),
    };

    renderHook(() => useProductSeo(product, 5));

    const metaTag = document.querySelector('meta[name="description"]');
    const content = metaTag.getAttribute("content");
    expect(content.length).toBeLessThanOrEqual(155);
  });
});
