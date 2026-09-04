import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ProductHero } from "./ProductHero";

describe("ProductHero", () => {
  const defaultProduct = {
    name: "Snail 96 Mucin Power Essence",
    description:
      "Formulated with 96% Snail Secretion Filtrate to repair and restore skin.",
    tag: "Best Seller",
    category: "Essence",
    primaryImageUrl: "https://example.com/snail-essence.jpg",
  };

  const defaultProps = {
    product: defaultProduct,
    brandName: "COSRX",
    price: "$25.00",
    updatedAt: "2023-10-01",
    source: "supabase",
    imageUrls: [
      "https://example.com/snail-essence.jpg",
      "https://example.com/snail-essence-2.jpg",
      "https://example.com/snail-essence-3.jpg",
    ],
  };

  it("renders product hero with all details", () => {
    render(<ProductHero {...defaultProps} />);

    expect(screen.getByText("COSRX")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Snail 96 Mucin Power Essence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Formulated with 96% Snail Secretion Filtrate to repair and restore skin.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Best Seller")).toBeInTheDocument();
    expect(screen.getByText("Essence")).toBeInTheDocument();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.getByText("Updated 2023-10-01")).toBeInTheDocument();
  });

  it("renders optional fields conditionally when omitted", () => {
    const minimalProduct = {
      name: "Minimal Cleanser",
    };

    render(
      <ProductHero
        product={minimalProduct}
        brandName="Minimal Brand"
        imageUrls={[]}
      />,
    );

    expect(screen.getByText("Minimal Brand")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Minimal Cleanser" }),
    ).toBeInTheDocument();

    expect(screen.queryByText("Best Seller")).not.toBeInTheDocument();
    expect(screen.queryByText("Updated")).not.toBeInTheDocument();
  });

  it("displays Live Supabase status when source is 'supabase'", () => {
    const { container } = render(
      <ProductHero
        product={defaultProduct}
        brandName="COSRX"
        source="supabase"
        imageUrls={[]}
      />,
    );

    expect(screen.getByText("Live Supabase")).toBeInTheDocument();
    const dot = container.querySelector(".pd-source-dot");
    expect(dot).toHaveClass("pd-source-dot", "supabase");
  });

  it("displays Detail fallback status when source is not 'supabase'", () => {
    const { container } = render(
      <ProductHero
        product={defaultProduct}
        brandName="COSRX"
        source="static"
        imageUrls={[]}
      />,
    );

    expect(screen.getByText("Detail fallback")).toBeInTheDocument();
    const dot = container.querySelector(".pd-source-dot");
    expect(dot).toHaveClass("pd-source-dot", "static");
  });

  it("falls back to 'static' class when source is undefined or empty", () => {
    const { container } = render(
      <ProductHero product={defaultProduct} brandName="COSRX" imageUrls={[]} />,
    );

    expect(screen.getByText("Detail fallback")).toBeInTheDocument();
    const dot = container.querySelector(".pd-source-dot");
    expect(dot).toHaveClass("pd-source-dot", "static");
  });

  it("does not render image strip if imageUrls length is 1 or empty", () => {
    render(
      <ProductHero
        product={defaultProduct}
        brandName="COSRX"
        imageUrls={["https://example.com/one.jpg"]}
      />,
    );

    expect(screen.queryByLabelText("Product images")).not.toBeInTheDocument();
  });

  it("renders image strip when imageUrls length is greater than 1, capping at 4 images", () => {
    const images = [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
      "https://example.com/4.jpg",
      "https://example.com/5.jpg",
    ];

    render(
      <ProductHero
        product={defaultProduct}
        brandName="COSRX"
        imageUrls={images}
      />,
    );

    const strip = screen.getByLabelText("Product images");
    expect(strip).toBeInTheDocument();

    const stripImages = strip.querySelectorAll("img");
    expect(stripImages).toHaveLength(4);
    expect(stripImages[0]).toHaveAttribute("src", "https://example.com/1.jpg");
    expect(stripImages[3]).toHaveAttribute("src", "https://example.com/4.jpg");
  });
});
