export function RecommendedProductsPanel({ recommendedItems, navigate }) {
  return (
    <section className="pd-panel">
      <div className="pd-section-heading">
        <h2>Recommended Products</h2>
        <span>{recommendedItems.length}</span>
      </div>

      {recommendedItems.length > 0 ? (
        <div className="pd-reco-list">
          {recommendedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pd-reco-item"
              onClick={() => item.slug && navigate(`/products/${item.slug}`)}
            >
              <strong>{item.name}</strong>
              <span>{item.brand}</span>
              <span>
                {[item.category, item.skin].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="pd-empty-inline">
          No related products are available right now.
        </div>
      )}
    </section>
  );
}
