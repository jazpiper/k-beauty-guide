import { useEffect } from "react";

export function useProductDocumentMeta(product, flagCount = 0) {
  useEffect(() => {
    if (!product) return undefined;
    const previousTitle = document.title;
    const metaName = "description";
    let metaTag = document.querySelector(`meta[name="${metaName}"]`);
    const hadMeta = Boolean(metaTag);

    if (!metaTag) {
      metaTag = document.createElement("meta");
      metaTag.setAttribute("name", metaName);
      document.head.appendChild(metaTag);
    }

    const previousDescription = metaTag.getAttribute("content") || "";
    const seoDescription = [
      product.name,
      product.category,
      product.skin,
      `Safety notes: ${flagCount}`,
      product.description,
    ]
      .filter(Boolean)
      .join(" • ")
      .slice(0, 155);

    document.title = `${product.name} | K-Beauty Guide`;
    metaTag.setAttribute("content", seoDescription);

    return () => {
      document.title = previousTitle;
      if (hadMeta) {
        metaTag.setAttribute("content", previousDescription);
      } else {
        metaTag.remove();
      }
    };
  }, [product, flagCount]);
}
