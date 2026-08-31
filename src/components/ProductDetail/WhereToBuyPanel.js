export function WhereToBuyPanel({ purchaseLinks, fallbackSearchUrl }) {
  return (
    <section className="pd-panel">
      <div className="pd-section-heading">
        <h2>Where to Buy</h2>
        <span>{purchaseLinks.length || (fallbackSearchUrl ? 1 : 0)}</span>
      </div>

      {purchaseLinks.length > 0 && (
        <div className="pd-source-list">
          {purchaseLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pd-source-link"
            >
              <span>{link.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      )}

      {purchaseLinks.length === 0 && fallbackSearchUrl && (
        <div className="pd-fallback-action">
          <a
            href={fallbackSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pd-source-link"
          >
            <span>Search for this product</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

      {purchaseLinks.length === 0 && !fallbackSearchUrl && (
        <div className="pd-empty-inline">
          No verified purchase link is available for this product yet.
        </div>
      )}
    </section>
  );
}
