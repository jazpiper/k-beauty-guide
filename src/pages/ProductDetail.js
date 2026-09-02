import { useNavigate, useParams } from "react-router-dom";
import { useProductDetail } from "../hooks/useProductDetail";
import { useProductDetailData } from "../hooks/useProductDetailData";
import { useProductSeo } from "../hooks/useProductSeo";
import { ProductHero } from "../components/ProductDetail/ProductHero";
import { ProductSummary } from "../components/ProductDetail/ProductSummary";
import { IngredientsPanel } from "../components/ProductDetail/IngredientsPanel";
import { CautionsPanel } from "../components/ProductDetail/CautionsPanel";
import { WhereToBuyPanel } from "../components/ProductDetail/WhereToBuyPanel";
import { SourceEvidencePanel } from "../components/ProductDetail/SourceEvidencePanel";
import { RecommendedProductsPanel } from "../components/ProductDetail/RecommendedProductsPanel";
import "./ProductDetail.css";

export default function ProductDetail({ slug: explicitSlug }) {
  const navigate = useNavigate();
  const params = useParams();
  const slug = explicitSlug || params.slug || params.productSlug || params.id;
  const detailData = useProductDetail(slug);
  const { product, source, error, loading } = detailData;

  const {
    ingredientItems,
    flagItems,
    sourceLinks,
    imageUrls,
    purchaseLinks,
    flagCount,
    highestSeverity,
    recommendedItems,
    brandName,
    price,
    updatedAt,
    hasWarnings,
    hasAnySourceEvidence,
    fallbackSearchUrl,
  } = useProductDetailData(detailData);

  useProductSeo(product, flagCount);

  return (
    <div className="pd-page">
      <div className="pd-shell">
        <button
          className="pd-back-btn"
          type="button"
          onClick={() => navigate("/products")}
        >
          <span aria-hidden="true">←</span>
          Back to products
        </button>

        {loading && (
          <section className="pd-state-card">
            <div className="pd-loader" aria-hidden="true"></div>
            <div>
              <h1>Loading product details...</h1>
              <p>
                Pulling together ingredients, cautions, images, and sources.
              </p>
            </div>
          </section>
        )}

        {!loading && error && (
          <section className="pd-state-card pd-state-error">
            <div className="pd-state-icon" aria-hidden="true">
              !
            </div>
            <div>
              <h1>Product detail unavailable</h1>
              <p>{error}</p>
            </div>
          </section>
        )}

        {!loading && !error && !product && (
          <section className="pd-state-card">
            <div className="pd-state-icon" aria-hidden="true">
              ?
            </div>
            <div>
              <h1>No product found</h1>
              <p>
                This product may have been removed or the detail data is not
                ready yet.
              </p>
            </div>
          </section>
        )}

        {!loading && !error && product && (
          <>
            <ProductHero
              product={product}
              brandName={brandName}
              price={price}
              updatedAt={updatedAt}
              source={source}
              imageUrls={imageUrls}
            />

            <ProductSummary
              flagCount={flagCount}
              highestSeverity={highestSeverity}
              hasWarnings={hasWarnings}
              ingredientItems={ingredientItems}
            />

            <div className="pd-content-grid">
              <IngredientsPanel ingredientItems={ingredientItems} />

              <aside className="pd-side-stack">
                <CautionsPanel flagItems={flagItems} />
                <WhereToBuyPanel
                  purchaseLinks={purchaseLinks}
                  fallbackSearchUrl={fallbackSearchUrl}
                />
                <SourceEvidencePanel
                  sourceLinks={sourceLinks}
                  hasAnySourceEvidence={hasAnySourceEvidence}
                />
                <RecommendedProductsPanel
                  recommendedItems={recommendedItems}
                  navigate={navigate}
                />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
