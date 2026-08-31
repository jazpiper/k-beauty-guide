import {
  asArray,
  normalizeSeverity,
  getSeverityLabel,
} from "../../utils/productUtils";

export function IngredientRow({ ingredient }) {
  const title =
    ingredient.name || ingredient.canonicalName || "Unnamed ingredient";
  const subtitle = [
    ingredient.korean,
    ingredient.canonicalName && ingredient.canonicalName !== title
      ? ingredient.canonicalName
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const tags = [
    ...asArray(ingredient.functionTags),
    ...asArray(ingredient.benefitTags),
  ];
  const severity = normalizeSeverity(
    ingredient.highestSeverity || ingredient.safety,
  );

  return (
    <li className="pd-ingredient-row">
      <div className="pd-ingredient-position">{ingredient.position || "–"}</div>
      <div className="pd-ingredient-main">
        <div className="pd-ingredient-name">{title}</div>
        {subtitle && <div className="pd-ingredient-subtitle">{subtitle}</div>}
        {tags.length > 0 && (
          <div className="pd-tag-row">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="pd-soft-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={`pd-severity pd-severity-${severity}`}>
        {getSeverityLabel(severity)}
      </span>
    </li>
  );
}
