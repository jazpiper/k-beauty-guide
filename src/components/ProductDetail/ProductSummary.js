import { getSeverityLabel } from "../../utils/productUtils";

export function ProductSummary({
  flagCount,
  highestSeverity,
  hasWarnings,
  ingredientItems,
}) {
  return (
    <section className="pd-summary-grid" aria-label="Safety summary">
      <div className="pd-summary-card">
        <span className="pd-summary-label">Ingredient flags</span>
        <strong>{flagCount}</strong>
        <span>{flagCount === 1 ? "note to review" : "notes to review"}</span>
      </div>
      <div className="pd-summary-card">
        <span className="pd-summary-label">Highest severity</span>
        <strong
          className={`pd-summary-severity pd-severity-${highestSeverity}`}
        >
          {getSeverityLabel(highestSeverity)}
        </strong>
        <span>
          {hasWarnings ? "Check the notes below" : "No caution flags yet"}
        </span>
      </div>
      <div className="pd-summary-card">
        <span className="pd-summary-label">Ingredients</span>
        <strong>{ingredientItems.length}</strong>
        <span>
          {ingredientItems.length === 1
            ? "ingredient listed"
            : "ingredients listed"}
        </span>
      </div>
    </section>
  );
}
