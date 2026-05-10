import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { productCategories, skinTypes } from "../data/products";
import { useProducts } from "../hooks/useProducts";
import "./Products.css";

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const { products, source, error, loading } = useProducts();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSkin, setActiveSkin] = useState("All Skin");
  const [liked, setLiked] = useState({});
  const [sortBy, setSortBy] = useState("popular");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("q") ?? "");
    const categoryParam = params.get("category") ?? "All";
    setActiveCategory(productCategories.includes(categoryParam) ? categoryParam : "All");
  }, [location.search]);

  const toggleLike = (id) => setLiked((p) => ({ ...p, [id]: !p[id] }));
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(location.search);
    const query = search.trim();
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    if (activeCategory && activeCategory !== "All") {
      params.set("category", activeCategory);
    } else {
      params.delete("category");
    }
    navigate({
      pathname: "/products",
      search: params.toString() ? `?${params.toString()}` : "",
    });
  };

  const matchesSkin = (productSkin, filterSkin) => {
    if (filterSkin === "All Skin") return true;
    const skinValue = String(productSkin ?? "").toLowerCase();
    const filterValue = filterSkin.toLowerCase();
    if (skinValue.includes(filterValue)) return true;
    if (filterValue === "combination") return skinValue.includes("combo");
    return false;
  };

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchSkin = matchesSkin(p.skin, activeSkin);
    const searchQuery = search.trim().toLowerCase();
    const searchHaystack = [p.name, p.brand, p.category, p.skin, p.tag].join(" ").toLowerCase();
    const matchSearch = !searchQuery || searchHaystack.includes(searchQuery);
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
        <form className="search-bar" onSubmit={handleSearchSubmit}>
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or brands..."
            aria-label="Search products by name, brand, category, skin, or tag"
          />
          <button type="submit" className="search-btn">Search</button>
        </form>
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
              <button key={c} type="button" onClick={() => setActiveCategory(c)}
                className={`filter-btn ${activeCategory === c ? "active" : ""}`}>{c}</button>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-title">Skin Type</div>
            {skinTypes.map((s) => (
              <button key={s} type="button" onClick={() => setActiveSkin(s)}
                className={`filter-btn ${activeSkin === s ? "active" : ""}`}>{s}</button>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-title">Sort By</div>
            <button type="button" onClick={() => setSortBy("popular")} className={`filter-btn ${sortBy === "popular" ? "active" : ""}`}>Most Popular</button>
            <button type="button" onClick={() => setSortBy("rating")} className={`filter-btn ${sortBy === "rating" ? "active" : ""}`}>Highest Rated</button>
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
                        {"⭐".repeat(Math.floor(p.rating))} <span>{p.rating} ({(p.reviews ?? 0).toLocaleString()})</span>
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
