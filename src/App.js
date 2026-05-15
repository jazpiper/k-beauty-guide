import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Ingredients from "./pages/Ingredients";
import ShoppingMap from "./pages/ShoppingMap";
import SkinQuiz from "./pages/SkinQuiz";
import AdminReview from "./pages/AdminReview";
import "./App.css";

const PAGE_ROUTES = {
  Home: "/",
  Products: "/products",
  Ingredients: "/ingredients",
  "Shopping Map": "/shopping-map",
  "Skin Quiz": "/skin-quiz",
  "Admin Review": "/admin-review",
};

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = getActivePage(location.pathname);

  const setActivePage = (page) => {
    navigate(PAGE_ROUTES[page] || "/");
  };

  return (
    <div className="app">
      <Navbar activePage={activePage} setActivePage={setActivePage} />
      <main>
        <Routes>
          <Route path="/" element={<Home setActivePage={setActivePage} />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/ingredients" element={<Ingredients />} />
          <Route path="/shopping-map" element={<ShoppingMap />} />
          <Route path="/skin-quiz" element={<SkinQuiz />} />
          <Route path="/admin-review" element={<AdminReview />} />
          <Route path="*" element={<Home setActivePage={setActivePage} />} />
        </Routes>
      </main>
    </div>
  );
}

function getActivePage(pathname) {
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/ingredients")) return "Ingredients";
  if (pathname.startsWith("/shopping-map")) return "Shopping Map";
  if (pathname.startsWith("/skin-quiz")) return "Skin Quiz";
  if (pathname.startsWith("/admin-review")) return "Admin Review";
  return "Home";
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
