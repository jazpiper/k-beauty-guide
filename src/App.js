import { useState } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Ingredients from "./pages/Ingredients";
import ShoppingMap from "./pages/ShoppingMap";
import SkinQuiz from "./pages/SkinQuiz";
import "./App.css";

export default function App() {
  const [activePage, setActivePage] = useState("Home");

  const renderPage = () => {
    switch (activePage) {
      case "Home": return <Home setActivePage={setActivePage} />;
      case "Products": return <Products />;
      case "Ingredients": return <Ingredients />;
      case "Shopping Map": return <ShoppingMap />;
      case "Skin Quiz": return <SkinQuiz />;
      default: return <Home setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="app">
      <Navbar activePage={activePage} setActivePage={setActivePage} />
      <main>{renderPage()}</main>
    </div>
  );
}
