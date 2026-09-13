import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import { response, sessionResponse } from "./test-helpers";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Lab 3 authenticated application shell", () => {
  it.each([
    ["IT_STAFF", "IT Staff"],
    ["ADMINISTRATOR", "Administrator"],
  ] as const)(
    "shows the %s identity without requester controls",
    async (role, label) => {
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/auth/me") {
          return Promise.resolve(
            response(sessionResponse({ role, name: `${label} User` })),
          );
        }
        return Promise.reject(
          new Error(`Unexpected request: ${String(input)}`),
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<App />);

      expect(
        await screen.findByRole("heading", {
          name: `${label} access is ready`,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Password" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Log out" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "My Tickets" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Create Ticket" }),
      ).not.toBeInTheDocument();
    },
  );

  it("logs out and does not leave the authenticated shell visible", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Promise.resolve(response(sessionResponse()));
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve(response(null, true, 204));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", { name: "Welcome, Requester A" });
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", {
        name: "Sign in to your service desk",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Welcome, Requester A")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input]) => String(input) === "/api/auth/logout",
      ),
    ).toBe(true);
  });
});
