import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";

function unauthenticatedResponse() {
  return {
    ok: false,
    status: 401,
    json: async () => ({
      error: { code: "SESSION_REQUIRED", message: "Sign in is required." },
    }),
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("authenticated application entry", () => {
  it("starts at the sign-in screen without a Development Requester selector", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(unauthenticatedResponse()),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Sign in to your service desk",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/)).not.toBeInTheDocument();
  });
});
