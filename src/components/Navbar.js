import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Home", icon: "🏠" },
  { label: "Products", icon: "🛍️" },
  { label: "Ingredients", icon: "🔬" },
  { label: "Shopping Map", icon: "🗺️" },
  { label: "Skin Quiz", icon: "💆" },
];

export default function Navbar({ activePage, setActivePage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="navbar">
      <div className="logo" onClick={() => setActivePage("Home")}>
        <span>🌸</span>
        <span className="logo-text">K-Beauty Guide</span>
      </div>
      <div className={`nav-links ${menuOpen ? "open" : ""}`}>
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
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>
    </nav>
  );
}
