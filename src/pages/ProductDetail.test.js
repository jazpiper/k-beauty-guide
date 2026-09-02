import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductDetail from "./ProductDetail";
import { useProductDetail } from "../hooks/useProductDetail";

jest.mock("../hooks/useProductDetail");

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("ProductDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state", () => {
    useProductDetail.mockReturnValue({
      product: null,
      ingredients: [],
      flags: [],
      sources: [],
      images: [],
      recommendedProducts: [],
      source: "static",
      error: null,
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={["/products/test-slug"]}>
        <Routes>
          <Route path="/products/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading product details...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    useProductDetail.mockReturnValue({
      product: null,
      ingredients: [],
      flags: [],
      sources: [],
      images: [],
      recommendedProducts: [],
      source: "static",
      error: "Product not found",
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/products/test-slug"]}>
        <Routes>
          <Route path="/products/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Product detail unavailable")).toBeInTheDocument();
    expect(screen.getByText("Product not found")).toBeInTheDocument();
  });

  it("renders no product found state", () => {
    useProductDetail.mockReturnValue({
      product: null,
      ingredients: [],
      flags: [],
      sources: [],
      images: [],
      recommendedProducts: [],
      source: "static",
      error: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/products/test-slug"]}>
        <Routes>
          <Route path="/products/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("No product found")).toBeInTheDocument();
  });

  it("renders product detail view when product exists", () => {
    const mockProduct = {
      slug: "test-product",
      name: "Test Gentle Cleanser",
      brandName: "K-Beauty Brand",
      description: "A very gentle cleanser.",
      category: "Cleanser",
      skin: "Sensitive",
      price: "$15.00",
    };

    useProductDetail.mockReturnValue({
      product: mockProduct,
      ingredients: [{ name: "Water" }],
      flags: [],
      sources: [],
      images: ["https://example.com/img.jpg"],
      recommendedProducts: [],
      source: "static",
      error: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/products/test-product"]}>
        <Routes>
          <Route path="/products/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Test Gentle Cleanser")).toBeInTheDocument();
    expect(screen.getByText("K-Beauty Brand")).toBeInTheDocument();
  });

  it("navigates back to products when back button is clicked", () => {
    useProductDetail.mockReturnValue({
      product: null,
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={["/products/test-slug"]}>
        <Routes>
          <Route path="/products/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const backButton = screen.getByRole("button", {
      name: /Back to products/i,
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/products");
  });
});
