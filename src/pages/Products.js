import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { productCategories, skinTypes } from "../data/products";
import { useProducts } from "../hooks/useProducts";
import "./Products.css";

export default function Products() {
  const navigate = useNavigate();
  const { products, source, error, loading } = useProducts();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSkin, setActiveSkin] = useState("All Skin");
  const [liked, setLiked] = useState({});
  const [sortBy, setSortBy] = useState("popular");

  const toggleLike = (id) => setLiked((p) => ({ ...p, [id]: !p[id] }));

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchSkin = activeSkin === "All Skin" || p.skin.includes(activeSkin);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSkin && matchSearch;
  }).sort((a, b) => {
    if (sortBy === "popular") return (b.reviews ?? 0) - (a.reviews ?? 0);
    if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return 0;
  });

  return (
    <div className="products-page">
      <div className="products-hero">
        <h1>🛍️ K-Beauty <span className="pink">Products</span></h1>
        <p>Explore the best Korean cosmetics loved by beauty fans worldwide</p>
        <div className="search-bar">
          <span>🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or brands..." />
        </div>
      </div>

      <div className="products-body">
        {/* FILTERS */}
        <aside className="filters">
          <div className="data-status">
            <span className={`source-dot ${source}`}></span>
            {source === "supabase" ? "Live Supabase" : "Static fallback"}
          </div>
          {error && <div className="data-error">Fallback reason: {error}</div>}
          <div className="filter-group">
            <div className="filter-title">Category</div>
            {productCategories.map((c) => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`filter-btn ${activeCategory === c ? "active" : ""}`}>{c}</button>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-title">Skin Type</div>
            {skinTypes.map((s) => (
              <button key={s} onClick={() => setActiveSkin(s)}
                className={`filter-btn ${activeSkin === s ? "active" : ""}`}>{s}</button>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-title">Sort By</div>
            <button onClick={() => setSortBy("popular")} className={`filter-btn ${sortBy === "popular" ? "active" : ""}`}>Most Popular</button>
            <button onClick={() => setSortBy("rating")} className={`filter-btn ${sortBy === "rating" ? "active" : ""}`}>Highest Rated</button>
          </div>
        </aside>

        {/* GRID */}
        <div className="products-main">
          <div className="results-info">{loading ? "Loading products..." : `${filtered.length} products found`}</div>
          <div className="grid">
            {filtered.map((p) => (
              <div key={p.id || p.slug} className="product-card">
                <div className="product-img" style={{ background: p.color }}>
                  {p.primaryImageUrl ? (
                    <img className="product-photo" src={p.primaryImageUrl} alt={p.name} />
                  ) : (
                    <span className="product-emoji">{p.emoji}</span>
                  )}
                  <span className="product-tag">{p.tag}</span>
                  <button onClick={() => toggleLike(p.id || p.slug)} className="like-btn">{liked[p.id || p.slug] ? "❤️" : "🤍"}</button>
                </div>
                <div className="product-info">
                  <div className="product-brand">{p.brand}</div>
                  <div className="product-name">{p.name}</div>
                  <div className="product-rating">
                    {p.rating ? (
                      <>
                        {"⭐".repeat(Math.floor(p.rating))} <span>{p.rating} ({p.reviews.toLocaleString()})</span>
                      </>
                    ) : (
                      <span>{p.safetyFlagCount > 0 ? `${p.safetyFlagCount} ingredient note${p.safetyFlagCount > 1 ? "s" : ""}` : "No safety flags yet"}</span>
                    )}
                  </div>
                  <div className="product-meta">
                    <span className="skin-badge">👤 {p.skin}</span>
                    <span className="price">{p.price}</span>
                  </div>
                  <button className="detail-btn" onClick={() => navigate(`/products/${p.slug || p.id}`)}>View Details</button>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="empty-state">No products match the current filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
