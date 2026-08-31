import { normalizeSeverity, getSeverityLabel } from "../../utils/productUtils";

export function CautionsPanel({ flagItems }) {
  return (
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
              <article
                key={`${flag.ingredientName || flag.title}-${index}`}
                className="pd-flag-card"
              >
                <div className="pd-flag-top">
                  <span className={`pd-severity pd-severity-${severity}`}>
                    {getSeverityLabel(severity)}
                  </span>
                  {flag.ingredientName && (
                    <span className="pd-flag-ingredient">
                      {flag.ingredientName}
                    </span>
                  )}
                </div>
                <h3>{flag.title || "Ingredient note"}</h3>
                {flag.description && <p>{flag.description}</p>}
                {flag.evidence && (
                  <div className="pd-evidence">{flag.evidence}</div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pd-clear-note">
          No caution or allergy flags are currently linked to this product.
          Always patch test if your skin is reactive.
        </div>
      )}
    </section>
  );
}
