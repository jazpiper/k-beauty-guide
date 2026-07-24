import { ProductImage } from "./ProductImage";

export function ProductHero({
  product,
  brandName,
  price,
  updatedAt,
  source,
  imageUrls,
}) {
  return (
    <>
      <section className="pd-hero">
        <div className="pd-hero-media">
          <ProductImage product={product} images={imageUrls} />
          {product.tag && <span className="pd-product-tag">{product.tag}</span>}
        </div>

        <div className="pd-hero-copy">
          <div className="pd-brand">{brandName}</div>
          <h1>{product.name}</h1>
          {product.description && (
            <p className="pd-description">{product.description}</p>
          )}

          <div className="pd-meta-row">
            {product.category && <span>{product.category}</span>}
            {price && <span>{price}</span>}
            {updatedAt && <span>Updated {updatedAt}</span>}
          </div>

          <div className="pd-data-status">
            <span className={`pd-source-dot ${source || "static"}`}></span>
            {source === "supabase" ? "Live Supabase" : "Detail fallback"}
          </div>
        </div>
      </section>

      {imageUrls.length > 1 && (
        <div className="pd-image-strip" aria-label="Product images">
          {imageUrls.slice(0, 4).map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </div>
      )}
    </>
  );
}
