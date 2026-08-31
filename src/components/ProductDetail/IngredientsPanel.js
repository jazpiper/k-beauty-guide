import { IngredientRow } from "./IngredientRow";

export function IngredientsPanel({ ingredientItems }) {
  return (
    <section className="pd-panel pd-ingredients-panel">
      <div className="pd-section-heading">
        <h2>Ingredient List</h2>
        <span>{ingredientItems.length} total</span>
      </div>

      {ingredientItems.length > 0 ? (
        <ol className="pd-ingredient-list">
          {ingredientItems.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.id || `${ingredient.name}-${index}`}
              ingredient={ingredient}
            />
          ))}
        </ol>
      ) : (
        <div className="pd-empty-inline">
          No ingredient list has been added for this product yet.
        </div>
      )}
    </section>
  );
}
