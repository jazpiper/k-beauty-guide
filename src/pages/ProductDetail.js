import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProductDetail } from "../hooks/useProductDetail";
import "./ProductDetail.css";

const severityRank = {
  restricted: 4,
  avoid_if_sensitive: 3,
  high: 3,
  medium: 2,
  caution: 2,
  info: 1,
  low: 1,
  review: 1,
  safe: 0,
  none: 0,
};

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function normalizeImage(image) {
  if (!image) return null;
  if (typeof image === "string") return image;
  return image.url || image.src || image.imageUrl || image.publicUrl || null;
}

function normalizeSourceLink(source) {
  if (!source) return null;
  const url = typeof source === "string" ? source : source.url || source.href || source.sourceUrl;
  if (!url) return null;

  let label = typeof source === "string" ? "" : source.label || source.title || source.name || "";
  try {
    const parsed = new URL(url);
    label = label || parsed.hostname.replace(/^www\./, "");
  } catch {
    label = label || url;
  }

  return { url, label };
}

function normalizeSeverity(value) {
  if (!value) return "none";
  return String(value).toLowerCase();
}

function getSeverityLabel(value) {
  const severity = normalizeSeverity(value);
  if (severity === "none") return "No flags";
  if (severity === "avoid_if_sensitive") return "Avoid if sensitive";
  return severity
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getHighestSeverity(product, flags, ingredients) {
  if (product?.highestSeverity) return normalizeSeverity(product.highestSeverity);
  const severities = [
    ...asArray(flags).map((flag) => flag?.severity),
    ...asArray(ingredients).map((ingredient) => ingredient?.highestSeverity || ingredient?.safety),
  ].map(normalizeSeverity);

  return severities.sort((a, b) => (severityRank[b] ?? 0) - (severityRank[a] ?? 0))[0] || "none";
}

function formatPrice(product) {
  if (!product) return "";
  if (product.price && typeof product.price === "string") return product.price;
  if (product.priceKrw != null) {
    const priceKrw = Number(String(product.priceKrw).replace(/[^\d.]/g, ""));
    return Number.isFinite(priceKrw) ? `₩${priceKrw.toLocaleString("ko-KR")}` : String(product.priceKrw);
  }
  if (product.price && product.currency) {
    const amount = Number(product.price);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(amount)
      : `${product.currency} ${product.price}`;
  }
  if (product.price) return String(product.price);
  return "";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function ProductImage({ product, images }) {
  const heroImage = normalizeImage(product?.primaryImageUrl) || normalizeImage(images?.[0]);

  if (heroImage) {
    return <img className="pd-hero-photo" src={heroImage} alt={product?.name || "Product"} />;
  }

  return <span className="pd-hero-emoji">{product?.emoji || "🌸"}</span>;
}

function IngredientRow({ ingredient }) {
  const title = ingredient.name || ingredient.canonicalName || "Unnamed ingredient";
  const subtitle = [ingredient.korean, ingredient.canonicalName && ingredient.canonicalName !== title ? ingredient.canonicalName : ""]
    .filter(Boolean)
    .join(" · ");
  const tags = [...asArray(ingredient.functionTags), ...asArray(ingredient.benefitTags)];
  const severity = normalizeSeverity(ingredient.highestSeverity || ingredient.safety);

  return (
    <li className="pd-ingredient-row">
      <div className="pd-ingredient-position">{ingredient.position || "–"}</div>
      <div className="pd-ingredient-main">
        <div className="pd-ingredient-name">{title}</div>
        {subtitle && <div className="pd-ingredient-subtitle">{subtitle}</div>}
        {tags.length > 0 && (
          <div className="pd-tag-row">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="pd-soft-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <span className={`pd-severity pd-severity-${severity}`}>{getSeverityLabel(severity)}</span>
    </li>
  );
}

export default function ProductDetail({ slug: explicitSlug }) {
  const navigate = useNavigate();
  const params = useParams();
  const slug = explicitSlug || params.slug || params.productSlug || params.id;
  const { product, ingredients = [], flags = [], sources = [], images = [], source, error, loading } = useProductDetail(slug);

  const ingredientItems = useMemo(() => asArray(ingredients), [ingredients]);
  const flagItems = useMemo(() => asArray(flags), [flags]);
  const sourceLinks = useMemo(() => asArray(sources).map(normalizeSourceLink).filter(Boolean), [sources]);
  const imageUrls = useMemo(() => asArray(images).map(normalizeImage).filter(Boolean), [images]);
  const brandName = product?.brandName || product?.brand || "K-Beauty";
  const price = formatPrice(product);
  const updatedAt = formatDate(product?.updatedAt || product?.publishedAt);
  const flagCount = product?.safetyFlagCount ?? flagItems.length;
  const highestSeverity = getHighestSeverity(product, flagItems, ingredientItems);
  const hasWarnings = flagItems.length > 0 || flagCount > 0;

  return (
    <div className="pd-page">
      <div className="pd-shell">
        <button className="pd-back-btn" type="button" onClick={() => navigate("/products")}>
          <span aria-hidden="true">←</span>
          Back to products
        </button>

        {loading && (
          <section className="pd-state-card">
            <div className="pd-loader" aria-hidden="true"></div>
            <div>
              <h1>Loading product details...</h1>
              <p>Pulling together ingredients, cautions, images, and sources.</p>
            </div>
          </section>
        )}

        {!loading && error && (
          <section className="pd-state-card pd-state-error">
            <div className="pd-state-icon" aria-hidden="true">!</div>
            <div>
              <h1>Product detail unavailable</h1>
              <p>{error}</p>
            </div>
          </section>
        )}

        {!loading && !error && !product && (
          <section className="pd-state-card">
            <div className="pd-state-icon" aria-hidden="true">?</div>
            <div>
              <h1>No product found</h1>
              <p>This product may have been removed or the detail data is not ready yet.</p>
            </div>
          </section>
        )}

        {!loading && !error && product && (
          <>
            <section className="pd-hero">
              <div className="pd-hero-media">
                <ProductImage product={product} images={imageUrls} />
                {product.tag && <span className="pd-product-tag">{product.tag}</span>}
              </div>

              <div className="pd-hero-copy">
                <div className="pd-brand">{brandName}</div>
                <h1>{product.name}</h1>
                {product.description && <p className="pd-description">{product.description}</p>}

                <div className="pd-meta-row">
                  {product.category && <span>{product.category}</span>}
                  {price && <span>{price}</span>}
                  {updatedAt && <span>Updated {updatedAt}</span>}
                </div>

                <div className="pd-data-status">
                  <span className={`source-dot ${source || "static"}`}></span>
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

            <section className="pd-summary-grid" aria-label="Safety summary">
              <div className="pd-summary-card">
                <span className="pd-summary-label">Ingredient flags</span>
                <strong>{flagCount}</strong>
                <span>{flagCount === 1 ? "note to review" : "notes to review"}</span>
              </div>
              <div className="pd-summary-card">
                <span className="pd-summary-label">Highest severity</span>
                <strong className={`pd-summary-severity pd-severity-${highestSeverity}`}>
                  {getSeverityLabel(highestSeverity)}
                </strong>
                <span>{hasWarnings ? "Check the notes below" : "No caution flags yet"}</span>
              </div>
              <div className="pd-summary-card">
                <span className="pd-summary-label">Ingredients</span>
                <strong>{ingredientItems.length}</strong>
                <span>{ingredientItems.length === 1 ? "ingredient listed" : "ingredients listed"}</span>
              </div>
            </section>

            <div className="pd-content-grid">
              <section className="pd-panel pd-ingredients-panel">
                <div className="pd-section-heading">
                  <h2>Ingredient List</h2>
                  <span>{ingredientItems.length} total</span>
                </div>

                {ingredientItems.length > 0 ? (
                  <ol className="pd-ingredient-list">
                    {ingredientItems.map((ingredient, index) => (
                      <IngredientRow key={ingredient.id || `${ingredient.name}-${index}`} ingredient={ingredient} />
                    ))}
                  </ol>
                ) : (
                  <div className="pd-empty-inline">No ingredient list has been added for this product yet.</div>
                )}
              </section>

              <aside className="pd-side-stack">
                <section className="pd-panel">
                  <div className="pd-section-heading">
                    <h2>Cautions & Allergy Notes</h2>
                    <span>{flagItems.length}</span>
                  </div>

                  {flagItems.length > 0 ? (
                    <div className="pd-flag-list">
                      {flagItems.map((flag, index) => {
                        const severity = normalizeSeverity(flag.severity);
                        return (
                          <article key={`${flag.ingredientName || flag.title}-${index}`} className="pd-flag-card">
                            <div className="pd-flag-top">
                              <span className={`pd-severity pd-severity-${severity}`}>{getSeverityLabel(severity)}</span>
                              {flag.ingredientName && <span className="pd-flag-ingredient">{flag.ingredientName}</span>}
                            </div>
                            <h3>{flag.title || "Ingredient note"}</h3>
                            {flag.description && <p>{flag.description}</p>}
                            {flag.evidence && <div className="pd-evidence">{flag.evidence}</div>}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pd-clear-note">
                      No caution or allergy flags are currently linked to this product. Always patch test if your skin is reactive.
                    </div>
                  )}
                </section>

                <section className="pd-panel">
                  <div className="pd-section-heading">
                    <h2>Sources</h2>
                    <span>{sourceLinks.length}</span>
                  </div>

                  {sourceLinks.length > 0 ? (
                    <div className="pd-source-list">
                      {sourceLinks.map((link) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="pd-source-link">
                          <span>{link.label}</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="pd-empty-inline">No external source links are available yet.</div>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
