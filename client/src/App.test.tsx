import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("TokTickIT foundation screen", () => {
  it("renders the application heading and Bootstrap action", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "TokTickIT IT Service Desk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check System" })).toHaveClass("btn", "btn-primary");
  });
});
