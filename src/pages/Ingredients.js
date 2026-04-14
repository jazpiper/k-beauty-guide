import { useState } from "react";
import "./Ingredients.css";

const INGREDIENTS = [
  { name: "Hyaluronic Acid", korean: "히알루론산", safety: "Safe", benefit: "Hydration", desc: "A powerful humectant that holds up to 1000x its weight in water. Great for all skin types.", emoji: "💧", color: "#E3F2FD", tags: ["Hydrating", "Plumping", "All Skin"] },
  { name: "Niacinamide", korean: "나이아신아마이드", safety: "Safe", benefit: "Brightening", desc: "Vitamin B3 derivative that reduces pores, evens skin tone, and controls sebum production.", emoji: "✨", color: "#FFF9C4", tags: ["Brightening", "Pore Care", "Oil Control"] },
  { name: "Centella Asiatica", korean: "병풀 추출물", safety: "Safe", benefit: "Soothing", desc: "Traditional herb that calms inflammation, speeds healing, and strengthens the skin barrier.", emoji: "🌿", color: "#E8F5E9", tags: ["Soothing", "Healing", "Sensitive Skin"] },
  { name: "Retinol", korean: "레티놀", safety: "Caution", benefit: "Anti-aging", desc: "Vitamin A derivative that promotes cell turnover. Use sunscreen and start with low concentrations.", emoji: "⚡", color: "#FFF3E0", tags: ["Anti-aging", "Acne", "PM Only"] },
  { name: "AHA (Glycolic Acid)", korean: "글리콜산", safety: "Caution", benefit: "Exfoliation", desc: "Alpha hydroxy acid that gently exfoliates dead skin cells, revealing brighter, smoother skin.", emoji: "🔬", color: "#FCE4EC", tags: ["Exfoliating", "Brightening", "PM Only"] },
  { name: "BHA (Salicylic Acid)", korean: "살리실산", safety: "Caution", benefit: "Acne Care", desc: "Oil-soluble acid that penetrates deep into pores to clear blackheads and treat acne.", emoji: "🧪", color: "#F3E5F5", tags: ["Acne", "Pore Care", "Oily Skin"] },
  { name: "Snail Mucin", korean: "달팽이 분비물 여과물", safety: "Safe", benefit: "Repair", desc: "Rich in glycoproteins and hyaluronic acid, helps repair damaged skin and boosts hydration.", emoji: "🐌", color: "#F1F8E9", tags: ["Repairing", "Hydrating", "Anti-aging"] },
  { name: "Vitamin C (Ascorbic Acid)", korean: "아스코르빈산", safety: "Safe", benefit: "Brightening", desc: "Powerful antioxidant that brightens skin, fades dark spots, and protects against UV damage.", emoji: "🍊", color: "#FFF8E1", tags: ["Brightening", "Antioxidant", "AM Use"] },
  { name: "Ceramides", korean: "세라마이드", safety: "Safe", benefit: "Barrier", desc: "Lipids that strengthen the skin barrier, preventing moisture loss and protecting from irritants.", emoji: "🛡️", color: "#E8EAF6", tags: ["Barrier", "Moisturizing", "Sensitive"] },
  { name: "Green Tea Extract", korean: "녹차 추출물", safety: "Safe", benefit: "Antioxidant", desc: "Rich in antioxidants, green tea reduces inflammation, fights free radicals, and soothes skin.", emoji: "🍵", color: "#E8F5E9", tags: ["Antioxidant", "Soothing", "All Skin"] },
  { name: "Propolis", korean: "프로폴리스", safety: "Safe", benefit: "Healing", desc: "Bee-derived resin with antibacterial and healing properties, perfect for acne-prone skin.", emoji: "🐝", color: "#FFF9C4", tags: ["Healing", "Antibacterial", "Acne"] },
  { name: "Adenosine", korean: "아데노신", safety: "Safe", benefit: "Anti-aging", desc: "FDA-approved anti-wrinkle ingredient that stimulates collagen production and reduces fine lines.", emoji: "🔬", color: "#FCE4EC", tags: ["Anti-aging", "Firming", "All Skin"] },
];

const BENEFITS = ["All", "Hydration", "Brightening", "Soothing", "Anti-aging", "Acne Care", "Barrier", "Exfoliation", "Repair", "Antioxidant", "Healing"];

export default function Ingredients() {
  const [search, setSearch] = useState("");
  const [activeBenefit, setActiveBenefit] = useState("All");
  const [selected, setSelected] = useState(null);
  const [scanText, setScanText] = useState("");
  const [scanResult, setScanResult] = useState([]);

  const filtered = INGREDIENTS.filter((ing) => {
    const matchBenefit = activeBenefit === "All" || ing.benefit === activeBenefit;
    const matchSearch = ing.name.toLowerCase().includes(search.toLowerCase()) || ing.korean.includes(search);
    return matchBenefit && matchSearch;
  });

  const handleScan = () => {
    const found = INGREDIENTS.filter((ing) =>
      scanText.toLowerCase().includes(ing.name.toLowerCase()) ||
      scanText.includes(ing.korean)
    );
    setScanResult(found);
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
          <div className="scanner-title">📋 Paste Ingredient List</div>
          <p className="scanner-desc">Copy the ingredient list from any product and paste it below to analyze</p>
          <textarea
            className="scanner-input"
            placeholder="e.g. Water, Niacinamide, Hyaluronic Acid, Glycerin, Centella Asiatica Extract..."
            value={scanText}
            onChange={(e) => setScanText(e.target.value)}
            rows={4}
          />
          <button className="scan-btn" onClick={handleScan}>🔍 Analyze Ingredients</button>
          {scanResult.length > 0 && (
            <div className="scan-results">
              <div className="scan-results-title">Found {scanResult.length} recognized ingredients:</div>
              {scanResult.map((r, i) => (
                <div key={i} className="scan-result-item" style={{ background: r.color }}>
                  <span>{r.emoji} {r.name}</span>
                  <span className={`safety-badge ${r.safety === "Safe" ? "safe" : "caution"}`}>{r.safety}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEARCH & FILTER */}
        <div className="ing-search-row">
          <input className="ing-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍  Search ingredient..." />
        </div>
        <div className="benefit-tabs">
          {BENEFITS.map((b) => (
            <button key={b} onClick={() => setActiveBenefit(b)}
              className={`benefit-tab ${activeBenefit === b ? "active" : ""}`}>{b}</button>
          ))}
        </div>

        {/* INGREDIENT GRID */}
        <div className="ing-grid">
          {filtered.map((ing, i) => (
            <div key={i} className="ing-card" style={{ borderTop: `4px solid ${ing.safety === "Safe" ? "#66BB6A" : "#FFA726"}` }}
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
        </div>
      </div>
    </div>
  );
}
