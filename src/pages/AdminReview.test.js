import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminReview from "./AdminReview";

describe("AdminReview Page", () => {
  it("renders page title and initial queue list", () => {
    render(<AdminReview />);

    expect(screen.getByText("Admin Review Queue")).toBeInTheDocument();
    expect(screen.getAllByText("REQ-2401").length).toBeGreaterThan(0);
    expect(screen.getByText("REQ-2402")).toBeInTheDocument();
    expect(screen.getByText("REQ-2403")).toBeInTheDocument();
  });

  it("selects item when clicked in queue list", () => {
    render(<AdminReview />);

    const secondItemButton = screen.getByText("Calm Cica Toner Pads").closest("button");
    fireEvent.click(secondItemButton);

    expect(screen.getAllByText("Calm Cica Toner Pads").length).toBeGreaterThan(0);
    expect(screen.getByText("Madecassoside, beta-glucan, panthenol, and 2% PHA pads. Alias: cica leaf extract.")).toBeInTheDocument();
  });

  it("updates status when action button is clicked", () => {
    render(<AdminReview />);

    const approveButton = screen.getByRole("button", { name: "Approve" });
    fireEvent.click(approveButton);

    expect(screen.getByText("Approved in shell state. Backend wiring pending.")).toBeInTheDocument();
  });
});
