import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";

test("renders wishlist buttons with accessible aria-label and aria-pressed attributes", () => {
  render(
    <MemoryRouter>
      <Home setActivePage={jest.fn()} />
    </MemoryRouter>
  );

  const wishlistButton = screen.getByRole("button", {
    name: "Save COSRX Snail 96 Mucin to wishlist",
  });
  expect(wishlistButton).toBeInTheDocument();
  expect(wishlistButton).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(wishlistButton);

  const updatedWishlistButton = screen.getByRole("button", {
    name: "Remove COSRX Snail 96 Mucin from wishlist",
  });
  expect(updatedWishlistButton).toBeInTheDocument();
  expect(updatedWishlistButton).toHaveAttribute("aria-pressed", "true");
});
