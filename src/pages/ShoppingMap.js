import { useEffect, useMemo, useState } from "react";
import "./ShoppingMap.css";
import { shoppingAreas, shoppingStores, shoppingTypes } from "../data/stores";

const formatCoordinate = (value) => value.toFixed(4);

const getMapBounds = (stores) => {
  const latitudes = stores.map((store) => store.lat);
  const longitudes = stores.map((store) => store.lng);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
};

const getPinStyle = (store, bounds) => {
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  const left = 10 + ((store.lng - bounds.minLng) / lngSpan) * 80;
  const top = 14 + (1 - (store.lat - bounds.minLat) / latSpan) * 64;

  return {
    left: `${Math.min(90, Math.max(8, left))}%`,
    top: `${Math.min(82, Math.max(12, top))}%`,
  };
};

export default function ShoppingMap() {
  const [activeArea, setActiveArea] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(
    () =>
      shoppingStores.filter((store) => {
        const matchArea = activeArea === "All" || store.area === activeArea;
        const matchType = activeType === "All" || store.type === activeType;
        return matchArea && matchType;
      }),
    [activeArea, activeType]
  );

  const mapBounds = useMemo(() => getMapBounds(shoppingStores), []);

  useEffect(() => {
    if (selected && !filtered.some((store) => store.id === selected.id)) {
      setSelected(null);
    }
  }, [filtered, selected]);

  return (
    <div className="map-page">
      <div className="map-hero">
        <h1>K-Beauty <span className="pink">Shopping Map</span></h1>
        <p>Static Seoul store data ready for Phase 2 map API wiring.</p>
      </div>

      <div className="map-container">
        <div className="map-visual">
          <div className="map-bg">
            <div className="map-title-overlay">Seoul K-Beauty hot spots</div>
            <div className="map-subtitle-overlay">
              Coordinates only for later map API integration
            </div>
            <div className="map-axis map-axis-top">N {formatCoordinate(mapBounds.maxLat)} </div>
            <div className="map-axis map-axis-bottom">S {formatCoordinate(mapBounds.minLat)} </div>
            <div className="map-axis map-axis-left">W {formatCoordinate(mapBounds.minLng)} </div>
            <div className="map-axis map-axis-right">E {formatCoordinate(mapBounds.maxLng)} </div>
            <div className="map-grid" aria-hidden="true" />
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`map-pin ${selected?.id === s.id ? "selected" : ""}`}
                style={getPinStyle(s, mapBounds)}
                onClick={() => setSelected(selected?.id === s.id ? null : s)}
                aria-label={`Select ${s.name}`}
              >
                <span>{s.emoji}</span>
                <div className="pin-label">{s.area}</div>
                <div className="pin-coords">
                  {formatCoordinate(s.lat)}, {formatCoordinate(s.lng)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="store-detail">
            <button type="button" className="close-btn" onClick={() => setSelected(null)}>
              ✕
            </button>
            <div className="store-emoji-big">{selected.emoji}</div>
            <div className="store-name">{selected.name}</div>
            <div className="store-area">📍 {selected.area}</div>
            <span className="store-type-badge">{selected.type}</span>
            <p className="store-desc">{selected.desc}</p>
            <div className="store-address">Address: {selected.address}</div>
            <div className="store-coords">
              Lat {formatCoordinate(selected.lat)} · Lng {formatCoordinate(selected.lng)}
            </div>
            <div className="store-open">🕐 {selected.open}</div>
            <div className="must-title">⭐ Must-try products:</div>
            <div className="must-list">
              {selected.must.map((m) => (
                <span key={m} className="must-tag">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="map-filters">
        <div className="filter-row">
          <span className="filter-label">Area:</span>
          {shoppingAreas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActiveArea(a)}
              className={`area-btn ${activeArea === a ? "active" : ""}`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">Type:</span>
          {shoppingTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveType(t)}
              className={`area-btn ${activeType === t ? "active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="store-list">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`store-card ${selected?.id === s.id ? "selected" : ""}`}
            onClick={() => setSelected(selected?.id === s.id ? null : s)}
          >
            <div className="store-card-emoji">{s.emoji}</div>
            <div className="store-card-info">
              <div className="store-card-name">{s.name}</div>
              <div className="store-card-area">
                📍 {s.area} · {s.type}
              </div>
              <div className="store-card-address">{s.address}</div>
              <div className="store-card-coords">
                {formatCoordinate(s.lat)}, {formatCoordinate(s.lng)}
              </div>
              <div className="store-card-open">🕐 {s.open}</div>
            </div>
            <div className="store-card-arrow">→</div>
          </button>
        ))}
      </div>
    </div>
  );
}
