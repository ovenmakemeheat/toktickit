import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("TokTickIT foundation screen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the application heading and Bootstrap action", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "TokTickIT IT Service Desk" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check System" })).toHaveClass(
      "btn",
      "btn-primary",
    );
  });

  it("shows Online when the health check succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", service: "TokTickIT API" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Backend status: Online",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/health");
  });

  it("shows Offline and a useful error when the API is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("API unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Backend status: Offline",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API",
    );
  });
});
