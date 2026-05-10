const endpoint = process.env.SUPABASE_FUNCTIONS_URL ||
  "http://127.0.0.1:54321/functions/v1/analyze-ingredient-text";

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ingredientText: "Water, Fragrance, Hyaluronic Acid" }),
  signal: AbortSignal.timeout(10_000),
});

const body = await response.json();

if (!response.ok || !body.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const parsedIngredients = body.data?.parsedIngredients ?? [];
const flags = body.data?.flags ?? [];

const fragrance = parsedIngredients.find((ingredient) => ingredient.rawName === "Fragrance");
const hyaluronic = parsedIngredients.find((ingredient) => ingredient.rawName === "Hyaluronic Acid");

if (body.data?.unmatchedCount !== 1) {
  console.error(`Expected unmatchedCount=1, received ${body.data?.unmatchedCount}`);
  process.exit(1);
}

if (fragrance?.displayName !== "Fragrance" || !fragrance?.ingredientId) {
  console.error("Expected Fragrance to match a Supabase ingredient");
  process.exit(1);
}

if (hyaluronic?.displayName !== "Sodium Hyaluronate" || !hyaluronic?.ingredientId) {
  console.error("Expected Hyaluronic Acid to match Sodium Hyaluronate");
  process.exit(1);
}

if (flags.length !== 1 || flags[0]?.title !== "Fragrance ingredient detected") {
  const receivedTitles = flags.map((flag) => flag.title).join(", ") || "(none)";
  console.error(`Expected exactly one flag titled "Fragrance ingredient detected"; received ${flags.length}: ${receivedTitles}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  parsedCount: parsedIngredients.length,
  unmatchedCount: body.data.unmatchedCount,
  flagCount: flags.length,
}, null, 2));
