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

  it("offers User Management only to an Administrator", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Promise.resolve(
          response(
            sessionResponse({ role: "ADMINISTRATOR", name: "Administrator" }),
          ),
        );
      }
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(
          response([
            {
              id: 1,
              name: "Administrator",
              email: "administrator@toktickit.test",
              role: "ADMINISTRATOR",
              status: "ACTIVE",
            },
          ]),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Administrator access is ready",
    });
    await user.click(screen.getByRole("button", { name: "User Management" }));

    expect(
      await screen.findByRole("heading", { name: "User Management" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin/users");
    expect(
      screen.getByRole("button", { name: "User Management" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "Ticket Review" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ticket Queue" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the authenticated shell visible when logout fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Promise.resolve(response(sessionResponse()));
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve(
          response(
            {
              error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Unable to complete request",
              },
            },
            false,
            500,
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", { name: "Welcome, Requester A" });
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(
      await screen.findByText(
        "Unable to sign out. Your session is still active. Try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
  });

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
