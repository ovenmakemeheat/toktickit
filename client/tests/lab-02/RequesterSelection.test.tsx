import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import { requesterAuthResponse, response } from "../lab-03/test-helpers";

function unauthenticatedResponse() {
  return response(
    { error: { code: "SESSION_REQUIRED", message: "Sign in is required." } },
    false,
    401,
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Lab 3 requester identity regression", () => {
  it("does not render the removed Development Requester selector", async () => {
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
    expect(
      screen.queryByRole("combobox", { name: "Development Requester" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change Requester" }),
    ).not.toBeInTheDocument();
  });

  it("shows the authenticated Requester identity in the shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(requesterAuthResponse)),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("requester-a@toktickit.test")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    const navigation = within(
      screen.getByRole("navigation", { name: "Application navigation" }),
    );
    expect(
      navigation.getByRole("button", { name: "My Tickets" }),
    ).toBeInTheDocument();
    expect(
      navigation.getByRole("button", { name: "Create Ticket" }),
    ).toBeInTheDocument();
  });
});
