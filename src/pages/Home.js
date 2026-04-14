import { useState } from "react";
import "./Home.css";

const CATEGORIES = [
  { emoji: "💧", label: "Toner" },
  { emoji: "✨", label: "Serum" },
  { emoji: "🧴", label: "Moisturizer" },
  { emoji: "🌞", label: "Sunscreen" },
  { emoji: "🧼", label: "Cleanser" },
  { emoji: "👁️", label: "Eye Cream" },
];

const TRENDING = [
  { name: "COSRX Snail 96 Mucin", brand: "COSRX", tag: "Bestseller", price: "₩18,000", skin: "All Skin", color: "#FFE4EC", emoji: "🐌" },
  { name: "Laneige Lip Sleeping Mask", brand: "Laneige", tag: "K-Icon", price: "₩22,000", skin: "Dry Lips", color: "#FFD6E7", emoji: "💋" },
  { name: "Some By Mi AHA BHA PHA", brand: "Some By Mi", tag: "Viral", price: "₩16,000", skin: "Oily/Acne", color: "#E8F4FD", emoji: "🌿" },
  { name: "Innisfree Green Tea Serum", brand: "Innisfree", tag: "Natural", price: "₩25,000", skin: "Sensitive", color: "#E8F8E8", emoji: "🍵" },
];

const TIPS = [
  { icon: "🔍", title: "Scan Ingredients", desc: "Point your camera at any product label for instant ingredient analysis" },
  { icon: "🗺️", title: "Find Stores", desc: "Discover the best K-beauty spots in Myeongdong, Hongdae & more" },
  { icon: "💆", title: "Skin Quiz", desc: "Get personalized product recommendations for your skin type" },
];

export default function Home({ setActivePage }) {
  const [searchVal, setSearchVal] = useState("");
  const [liked, setLiked] = useState({});
  const toggleLike = (i) => setLiked((p) => ({ ...p, [i]: !p[i] }));

  return (
    <div>
      {/* HERO */}
      <section className="hero">
        <div className="hero-deco deco-1">🌸</div>
        <div className="hero-deco deco-2">✨</div>
        <div className="hero-deco deco-3">💄</div>
        <div className="hero-deco deco-4">🧴</div>
        <span className="hero-badge">🇰🇷 Your Ultimate K-Beauty Companion</span>
        <h1 className="hero-title">
          Discover <span className="gradient-text">Korean Beauty</span><br />Like Never Before
        </h1>
        <p className="hero-desc">
          Search products, decode ingredients, and find the best beauty spots across Korea — all in one place.
        </p>
        <div className="search-bar">
          <span>🔍</span>
          <input value={searchVal} onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search products, ingredients, brands..." className="search-input" />
          <button className="search-btn">Search</button>
        </div>
        <div className="tags">
          {["Hyaluronic Acid", "Niacinamide", "COSRX", "Sunscreen SPF50"].map((tag) => (
            <span key={tag} className="tag" onClick={() => setActivePage("Ingredients")}>{tag}</span>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section">
        <h2 className="section-title">Browse by <span className="pink">Category</span></h2>
        <div className="categories">
          {CATEGORIES.map((c) => (
            <button key={c.label} className="category-btn" onClick={() => setActivePage("Products")}>
              <span className="category-emoji">{c.emoji}</span>
              <span className="category-label">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* TRENDING */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">🔥 Trending <span className="pink">Now</span></h2>
          <button className="view-all" onClick={() => setActivePage("Products")}>View All →</button>
        </div>
        <div className="products-grid">
          {TRENDING.map((p, i) => (
            <div key={i} className="product-card">
              <div className="product-img" style={{ background: p.color }}>
                <span className="product-emoji">{p.emoji}</span>
                <span className="product-tag">{p.tag}</span>
                <button onClick={() => toggleLike(i)} className="like-btn">{liked[i] ? "❤️" : "🤍"}</button>
              </div>
              <div className="product-info">
                <div className="product-brand">{p.brand}</div>
                <div className="product-name">{p.name}</div>
                <div className="product-meta">
                  <span className="product-skin">👤 {p.skin}</span>
                  <span className="product-price">{p.price}</span>
                </div>
                <button className="detail-btn">View Details</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section">
        <div className="section">
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 className="section-title">Everything You Need for Your <span className="pink">K-Beauty Journey</span></h2>
            <p style={{ color: "#999", fontSize: 14, marginTop: 8 }}>Tools designed specifically for international beauty lovers</p>
          </div>
          <div className="features-grid">
            {TIPS.map((t, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{t.icon}</div>
                <div className="feature-title">{t.title}</div>
                <div className="feature-desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BANNER */}
      <section className="section">
        <div className="banner">
          <div>
            <div className="banner-sub">✨ New Feature</div>
            <div className="banner-title">Take the Skin Quiz!</div>
            <div className="banner-desc">Get your personalized K-beauty routine in 2 minutes</div>
          </div>
          <button className="banner-btn" onClick={() => setActivePage("Skin Quiz")}>Start Quiz →</button>
        </div>
      </section>

      <footer className="footer">
        <div style={{ fontSize: 18, marginBottom: 8, color: "#FF6B9D" }}>🌸 <strong>K-Beauty Guide</strong></div>
        <div>Made with 💕 for international K-beauty lovers · Seoul, Korea 🇰🇷</div>
      </footer>
    </div>
  );
}
