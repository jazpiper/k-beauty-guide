import { useState } from "react";
import { analyzeIngredientText } from "../api/ingredientsApi";
import { ingredientBenefits } from "../data/ingredients";
import { useIngredients } from "../hooks/useIngredients";
import "./Ingredients.css";

export default function Ingredients() {
  const { ingredients, source, error, loading } = useIngredients();
  const [search, setSearch] = useState("");
  const [activeBenefit, setActiveBenefit] = useState("All");
  const [selected, setSelected] = useState(null);
  const [scanText, setScanText] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

  const filtered = ingredients.filter((ing) => {
    const matchBenefit = activeBenefit === "All" || ing.benefit === activeBenefit;
    const matchSearch = ing.name.toLowerCase().includes(search.toLowerCase()) || ing.korean.includes(search);
    return matchBenefit && matchSearch;
  });

  const handleScan = async () => {
    if (!scanText.trim()) return;

    setScanLoading(true);
    const result = await analyzeIngredientText(scanText, ingredients);
    setScanResult(result);
    setScanLoading(false);
  };

  return (
    <div className="ing-page">
      <div className="ing-hero">
        <h1>🔬 Ingredient <span className="pink">Analyzer</span></h1>
        <p>Decode what's really in your K-beauty products</p>
      </div>

      <div className="ing-body">
        {/* SCANNER */}
        <div className="scanner-card">
          <div className="data-status">
            <span className={`source-dot ${source}`}></span>
            {source === "supabase" ? "Live Supabase" : "Static fallback"}
          </div>
          {error && <div className="data-error">Fallback reason: {error}</div>}
          <div className="scanner-title">📋 Paste Ingredient List</div>
          <p className="scanner-desc">Copy the ingredient list from any product and paste it below to analyze</p>
          <textarea
            className="scanner-input"
            placeholder="e.g. Water, Niacinamide, Hyaluronic Acid, Glycerin, Centella Asiatica Extract..."
            value={scanText}
            onChange={(e) => setScanText(e.target.value)}
            rows={4}
          />
          <button className="scan-btn" onClick={handleScan} disabled={scanLoading || !scanText.trim()}>
            {scanLoading ? "Analyzing..." : "🔍 Analyze Ingredients"}
          </button>
          {scanResult && (
            <div className="scan-results">
              <div className="scan-results-title">
                Parsed {scanResult.parsedIngredients.length} ingredients · {scanResult.source === "supabase" ? "Edge Function" : "Local fallback"}
              </div>
              {scanResult.parsedIngredients.map((r) => (
                <div key={`${r.position}-${r.rawName}`} className="scan-result-item" style={{ background: r.color || "#FFF0F5" }}>
                  <span>{r.position}. {r.displayName}</span>
                  <span className={`safety-badge ${r.safety === "Caution" ? "caution" : r.ingredientId ? "safe" : "review"}`}>
                    {r.ingredientId ? r.safety : "Review"}
                  </span>
                </div>
              ))}
              {scanResult.flags.length > 0 && (
                <div className="analyzer-note">{scanResult.flags.length} caution signal detected. This is educational, not medical advice.</div>
              )}
              <div className="analyzer-note">{scanResult.disclaimer}</div>
            </div>
          )}
        </div>

        {/* SEARCH & FILTER */}
        <div className="ing-search-row">
          <input className="ing-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍  Search ingredient..." />
        </div>
        <div className="benefit-tabs">
          {ingredientBenefits.map((b) => (
            <button key={b} onClick={() => setActiveBenefit(b)}
              className={`benefit-tab ${activeBenefit === b ? "active" : ""}`}>{b}</button>
          ))}
        </div>

        {/* INGREDIENT GRID */}
        {loading && <div className="results-info">Loading ingredients...</div>}
        <div className="ing-grid">
          {filtered.map((ing) => (
            <div key={ing.id || ing.name} className="ing-card" style={{ borderTop: `4px solid ${ing.safety === "Safe" ? "#66BB6A" : "#FFA726"}` }}
              onClick={() => setSelected(selected?.name === ing.name ? null : ing)}>
              <div className="ing-card-top" style={{ background: ing.color }}>
                <span className="ing-emoji">{ing.emoji}</span>
                <span className={`safety-badge ${ing.safety === "Safe" ? "safe" : "caution"}`}>{ing.safety}</span>
              </div>
              <div className="ing-card-body">
                <div className="ing-name">{ing.name}</div>
                <div className="ing-korean">{ing.korean}</div>
                <div className="ing-benefit-label">{ing.benefit}</div>
                <div className="ing-tags">
                  {ing.tags.map((t) => <span key={t} className="ing-tag">{t}</span>)}
                </div>
                {selected?.name === ing.name && (
                  <div className="ing-desc">{ing.desc}</div>
                )}
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="empty-state">No ingredients match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
