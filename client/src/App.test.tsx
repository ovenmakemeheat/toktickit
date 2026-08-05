import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const healthResponse = {
  ok: true,
  json: async () => ({ status: "ok", service: "TokTickIT API" }),
};

const categoryResponse = {
  ok: true,
  json: async () => [
    { id: 1, name: "Account and Access" },
    { id: 2, name: "Hardware" },
    { id: 3, name: "Software" },
    { id: 4, name: "Network" },
  ],
};

describe("TokTickIT system-check screen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the application heading and Check System action", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "TokTickIT IT Service Desk" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check System" })).toHaveClass(
      "btn",
      "btn-primary",
    );
  });

  it("transitions from checking to Online and renders returned categories", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(healthResponse)
      .mockResolvedValueOnce(categoryResponse);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "System Status: Online",
    );
    expect(
      screen.getByRole("list", { name: "IT request categories" }),
    ).toHaveTextContent("Account and Access");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/health");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/categories");
  });

  it("clears stale categories and shows Offline when either API request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(healthResponse)
      .mockResolvedValueOnce(categoryResponse)
      .mockRejectedValue(new Error("API unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));
    expect(
      await screen.findByRole("list", { name: "IT request categories" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "System Status: Offline",
    );
    expect(screen.queryByRole("list", { name: "IT request categories" })).toBe(
      null,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API",
    );
  });
});
