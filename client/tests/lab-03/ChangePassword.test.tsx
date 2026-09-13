import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import { response, sessionResponse } from "./test-helpers";

const initialAuth = sessionResponse({ mustChangePassword: true });
const changedAuth = sessionResponse({ mustChangePassword: false });

function setupFetch() {
  const fetchMock = vi.fn(
    (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Promise.resolve(response(initialAuth));
      }
      if (url === "/api/auth/password") {
        return Promise.resolve(response(changedAuth));
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve(response(null, true, 204));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Lab 3 mandatory initial password change", () => {
  it("blocks the normal shell and explains the password rules", async () => {
    setupFetch();

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Change your initial password",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Current password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/New password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm new password/)).toBeInTheDocument();
    expect(screen.getByText(/12-128 characters/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "My Tickets" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("shows client validation and does not submit an invalid password", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Change your initial password",
    });
    await user.type(
      screen.getByLabelText(/Current password/),
      "initial-password",
    );
    await user.type(screen.getByLabelText(/New password/), "short");
    await user.type(screen.getByLabelText(/Confirm new password/), "different");
    await user.click(screen.getByRole("button", { name: "Save new password" }));

    expect(
      screen.getByText(/Password must contain 12-128/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("New password and confirmation must match."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/auth/password",
      ),
    ).toHaveLength(0);
  });

  it("saves a valid password and then opens the authenticated shell", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Change your initial password",
    });
    await user.type(
      screen.getByLabelText(/Current password/),
      "initial-password",
    );
    await user.type(
      screen.getByLabelText(/New password/),
      "NewSecurePassword1!",
    );
    await user.type(
      screen.getByLabelText(/Confirm new password/),
      "NewSecurePassword1!",
    );
    await user.click(screen.getByRole("button", { name: "Save new password" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeInTheDocument();
    const passwordCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/auth/password",
    );
    expect(passwordCall).toBeDefined();
    const passwordOptions = passwordCall?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(passwordOptions?.body))).toEqual({
      currentPassword: "initial-password",
      newPassword: "NewSecurePassword1!",
      confirmPassword: "NewSecurePassword1!",
    });
  });
});
