import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Home", icon: "🏠" },
  { label: "Products", icon: "🛍️" },
  { label: "Ingredients", icon: "🔬" },
  { label: "Shopping Map", icon: "🗺️" },
  { label: "Skin Quiz", icon: "💆" },
  { label: "Admin Review", icon: "🧾" },
];

export default function Navbar({ activePage, setActivePage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const mobileMenuId = "primary-nav-links";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="navbar">
      <button
        type="button"
        className="navbar-logo"
        aria-label="Go to home"
        onClick={() => setActivePage("Home")}
      >
        <span>🌸</span>
        <span className="navbar-logo-text">K-Beauty Guide</span>
      </button>
      <div id={mobileMenuId} className={`nav-links ${menuOpen ? "open" : ""}`}>
        {NAV_LINKS.map((n) => (
          <button
            key={n.label}
            onClick={() => { setActivePage(n.label); setMenuOpen(false); }}
            className={`nav-btn ${activePage === n.label ? "active" : ""}`}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>
      <div className="nav-right">
        <button className="lang-btn">🌍 EN</button>
        <button
          type="button"
          className="hamburger"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls={mobileMenuId}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
      </div>
    </nav>
  );
}
