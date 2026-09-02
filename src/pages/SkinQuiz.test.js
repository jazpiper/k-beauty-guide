import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SkinQuiz from "./SkinQuiz";

describe("SkinQuiz accessibility", () => {
  it("renders quiz intro start button", () => {
    render(<SkinQuiz />);
    expect(
      screen.getByRole("button", { name: /start quiz/i }),
    ).toBeInTheDocument();
  });

  it("renders progressbar and radiogroup attributes when quiz is started", () => {
    render(<SkinQuiz />);
    const startBtn = screen.getByRole("button", { name: /start quiz/i });
    fireEvent.click(startBtn);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "1");
    expect(progressbar).toHaveAttribute("aria-valuemin", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "5");

    const radiogroup = screen.getByRole("radiogroup");
    expect(radiogroup).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(4);
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute("aria-checked", "false");
    });
  });
});
