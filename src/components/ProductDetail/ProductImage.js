import { normalizeImage } from "../../utils/productUtils";

export function ProductImage({ product, images }) {
  const heroImage =
    normalizeImage(product?.primaryImageUrl) || normalizeImage(images?.[0]);

  if (heroImage) {
    return (
      <img
        className="pd-hero-photo"
        src={heroImage}
        alt={product?.name || "Product"}
      />
    );
  }

  return <span className="pd-hero-emoji">{product?.emoji || "🌸"}</span>;
}
