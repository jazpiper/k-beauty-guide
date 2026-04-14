import { useState } from "react";
import "./Products.css";

const ALL_PRODUCTS = [
  { name: "COSRX Snail 96 Mucin Power Essence", brand: "COSRX", tag: "Bestseller", price: "₩18,000", skin: "All Skin", category: "Serum", color: "#FFE4EC", emoji: "🐌", rating: 4.9, reviews: 12400 },
  { name: "Laneige Lip Sleeping Mask", brand: "Laneige", tag: "K-Icon", price: "₩22,000", skin: "Dry Lips", category: "Moisturizer", color: "#FFD6E7", emoji: "💋", rating: 4.8, reviews: 9800 },
  { name: "Some By Mi AHA BHA PHA Toner", brand: "Some By Mi", tag: "Viral", price: "₩16,000", skin: "Oily/Acne", category: "Toner", color: "#E8F4FD", emoji: "🌿", rating: 4.7, reviews: 8200 },
  { name: "Innisfree Green Tea Hyaluronic Serum", brand: "Innisfree", tag: "Natural", price: "₩25,000", skin: "Sensitive", category: "Serum", color: "#E8F8E8", emoji: "🍵", rating: 4.6, reviews: 6100 },
  { name: "Etude House SoonJung Toner", brand: "Etude House", tag: "Soothing", price: "₩14,000", skin: "Sensitive", category: "Toner", color: "#FFF3E0", emoji: "🌾", rating: 4.7, reviews: 5400 },
  { name: "Sulwhasoo First Care Serum", brand: "Sulwhasoo", tag: "Luxury", price: "₩89,000", skin: "Mature", category: "Serum", color: "#F3E5F5", emoji: "🌺", rating: 4.9, reviews: 4300 },
  { name: "TONYMOLY Tako Pore Blackhead", brand: "TONYMOLY", tag: "Pore Care", price: "₩9,000", skin: "Oily", category: "Cleanser", color: "#E0F7FA", emoji: "🐙", rating: 4.5, reviews: 7700 },
  { name: "Missha Time Revolution Toner", brand: "Missha", tag: "Hydrating", price: "₩21,000", skin: "Dry", category: "Toner", color: "#FBE9E7", emoji: "⏰", rating: 4.6, reviews: 5900 },
  { name: "Purito Centella Unscented Serum", brand: "Purito", tag: "Gentle", price: "₩19,000", skin: "All Skin", category: "Serum", color: "#F1F8E9", emoji: "🌱", rating: 4.8, reviews: 6600 },
  { name: "Klairs Midnight Blue Calming Cream", brand: "Klairs", tag: "Calming", price: "₩28,000", skin: "Sensitive", category: "Moisturizer", color: "#E8EAF6", emoji: "🌙", rating: 4.7, reviews: 4800 },
  { name: "Banila Co Clean It Zero Balm", brand: "Banila Co", tag: "Cleansing", price: "₩17,000", skin: "All Skin", category: "Cleanser", color: "#FFF8E1", emoji: "🧸", rating: 4.8, reviews: 11200 },
  { name: "ANUA Heartleaf Pore Control Serum", brand: "ANUA", tag: "Trending", price: "₩23,000", skin: "Oily/Combo", category: "Serum", color: "#F9FBE7", emoji: "🍀", rating: 4.9, reviews: 8900 },
];

const CATEGORIES = ["All", "Toner", "Serum", "Moisturizer", "Cleanser", "Sunscreen", "Eye Cream"];
const SKIN_TYPES = ["All Skin", "Dry", "Oily", "Sensitive", "Combination", "Mature"];

export default function Products() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSkin, setActiveSkin] = useState("All Skin");
  const [liked, setLiked] = useState({});
  const [sortBy, setSortBy] = useState("popular");

  const toggleLike = (i) => setLiked((p) => ({ ...p, [i]: !p[i] }));

  const filtered = ALL_PRODUCTS.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchSkin = activeSkin === "All Skin" || p.skin.includes(activeSkin);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSkin && matchSearch;
  }).sort((a, b) => sortBy === "popular" ? b.reviews - a.reviews : sortBy === "rating" ? b.rating - a.rating : 0);

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
          <div className="filter-group">
            <div className="filter-title">Category</div>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`filter-btn ${activeCategory === c ? "active" : ""}`}>{c}</button>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-title">Skin Type</div>
            {SKIN_TYPES.map((s) => (
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
          <div className="results-info">{filtered.length} products found</div>
          <div className="grid">
            {filtered.map((p, i) => (
              <div key={i} className="product-card">
                <div className="product-img" style={{ background: p.color }}>
                  <span className="product-emoji">{p.emoji}</span>
                  <span className="product-tag">{p.tag}</span>
                  <button onClick={() => toggleLike(i)} className="like-btn">{liked[i] ? "❤️" : "🤍"}</button>
                </div>
                <div className="product-info">
                  <div className="product-brand">{p.brand}</div>
                  <div className="product-name">{p.name}</div>
                  <div className="product-rating">
                    {"⭐".repeat(Math.floor(p.rating))} <span>{p.rating} ({p.reviews.toLocaleString()})</span>
                  </div>
                  <div className="product-meta">
                    <span className="skin-badge">👤 {p.skin}</span>
                    <span className="price">{p.price}</span>
                  </div>
                  <button className="detail-btn">View Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
