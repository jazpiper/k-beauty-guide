import "./ShoppingMap.css";

const SPOTS = [
  { name: "Olive Young Myeongdong", area: "Myeongdong", type: "Drugstore", emoji: "🏪", desc: "Korea's #1 beauty drugstore. Huge selection, best prices.", open: "9AM–11PM", must: ["COSRX", "Some By Mi", "Anua"] },
  { name: "Innisfree Flagship Myeongdong", area: "Myeongdong", type: "Brand Store", emoji: "🌿", desc: "Nature-inspired K-beauty. Try their Jeju collection!", open: "10AM–10PM", must: ["Green Tea Serum", "Sunscreen"] },
  { name: "Etude House Hongdae", area: "Hongdae", type: "Brand Store", emoji: "🎀", desc: "Playful, colorful makeup & skincare for the young crowd.", open: "11AM–10PM", must: ["SoonJung Line", "Play Color Eyes"] },
  { name: "Lotte Duty Free Beauty", area: "Jung-gu", type: "Duty Free", emoji: "✈️", desc: "Tax-free luxury brands: Sulwhasoo, Laneige, Hera.", open: "9:30AM–7PM", must: ["Sulwhasoo Set", "Laneige Mask"] },
  { name: "Aritaum Gangnam", area: "Gangnam", type: "Multi-brand", emoji: "💄", desc: "Amorepacific's multi-brand concept store with top picks.", open: "10:30AM–9:30PM", must: ["Iope", "Hanyul"] },
  { name: "Olive Young Hongdae", area: "Hongdae", type: "Drugstore", emoji: "🏪", desc: "Youth district location with trendy, viral K-beauty picks.", open: "10AM–11PM", must: ["Torriden", "Beauty of Joseon"] },
  { name: "Shinsegae Beauty", area: "Jung-gu", type: "Department Store", emoji: "🏬", desc: "Premium K-beauty in a luxury department store setting.", open: "10:30AM–8PM", must: ["Dr. Jart+", "Whoo"] },
  { name: "Beauty Factory Dongdaemun", area: "Dongdaemun", type: "Market", emoji: "🌙", desc: "Open late night! Best prices on bulk K-beauty products.", open: "10AM–5AM", must: ["Sheet Masks", "Ampoules"] },
];

const AREAS = ["All", "Myeongdong", "Hongdae", "Gangnam", "Jung-gu", "Dongdaemun"];
const TYPES = ["All", "Drugstore", "Brand Store", "Duty Free", "Department Store", "Multi-brand", "Market"];

import { useState } from "react";

export default function ShoppingMap() {
  const [activeArea, setActiveArea] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [selected, setSelected] = useState(null);

  const filtered = SPOTS.filter((s) => {
    const matchArea = activeArea === "All" || s.area === activeArea;
    const matchType = activeType === "All" || s.type === activeType;
    return matchArea && matchType;
  });

  return (
    <div className="map-page">
      <div className="map-hero">
        <h1>🗺️ K-Beauty <span className="pink">Shopping Map</span></h1>
        <p>Find the best beauty stores across Seoul</p>
      </div>

      {/* MAP PLACEHOLDER */}
      <div className="map-container">
        <div className="map-visual">
          <div className="map-bg">
            <div className="map-title-overlay">📍 Seoul K-Beauty Hot Spots</div>
            {filtered.map((s, i) => (
              <div key={i} className={`map-pin ${selected?.name === s.name ? "selected" : ""}`}
                style={{ top: `${20 + (i * 11) % 65}%`, left: `${15 + (i * 17) % 70}%` }}
                onClick={() => setSelected(selected?.name === s.name ? null : s)}>
                <span>{s.emoji}</span>
                <div className="pin-label">{s.area}</div>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div className="store-detail">
            <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
            <div className="store-emoji-big">{selected.emoji}</div>
            <div className="store-name">{selected.name}</div>
            <div className="store-area">📍 {selected.area}</div>
            <span className="store-type-badge">{selected.type}</span>
            <p className="store-desc">{selected.desc}</p>
            <div className="store-open">🕐 {selected.open}</div>
            <div className="must-title">⭐ Must-try products:</div>
            <div className="must-list">
              {selected.must.map((m, i) => <span key={i} className="must-tag">{m}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* FILTERS */}
      <div className="map-filters">
        <div className="filter-row">
          <span className="filter-label">Area:</span>
          {AREAS.map((a) => (
            <button key={a} onClick={() => setActiveArea(a)}
              className={`area-btn ${activeArea === a ? "active" : ""}`}>{a}</button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">Type:</span>
          {TYPES.map((t) => (
            <button key={t} onClick={() => setActiveType(t)}
              className={`area-btn ${activeType === t ? "active" : ""}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* STORE LIST */}
      <div className="store-list">
        {filtered.map((s, i) => (
          <div key={i} className={`store-card ${selected?.name === s.name ? "selected" : ""}`}
            onClick={() => setSelected(selected?.name === s.name ? null : s)}>
            <div className="store-card-emoji">{s.emoji}</div>
            <div className="store-card-info">
              <div className="store-card-name">{s.name}</div>
              <div className="store-card-area">📍 {s.area} · {s.type}</div>
              <div className="store-card-open">🕐 {s.open}</div>
            </div>
            <div className="store-card-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
}
