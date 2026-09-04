import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Lab 2 requester context application", () => {
  it("starts at Development Requester Selection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: "Requester A",
            email: "requester-a@toktickit.test",
          },
        ],
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Select a Development Requester",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
