import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import { requesterAuthResponse, response } from "./test-helpers";

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

describe("Lab 3 login", () => {
  it("starts with a focused sign-in form and no requester selector", async () => {
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
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change Requester" }),
    ).not.toBeInTheDocument();
  });

  it("validates required fields before making a login request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(unauthenticatedResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Sign in to your service desk",
    });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a generic invalid-credential failure and clears the password", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      return String(input) === "/api/auth/me"
        ? Promise.resolve(unauthenticatedResponse())
        : Promise.resolve(
            response(
              { error: { code: "INVALID_CREDENTIALS", message: "safe" } },
              false,
              401,
            ),
          );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Sign in to your service desk",
    });
    await user.type(screen.getByLabelText(/Email/), "person@example.test");
    await user.type(screen.getByLabelText(/Password/), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(screen.getByLabelText(/Password/)).toHaveValue("");
    expect(screen.queryByText("safe")).not.toBeInTheDocument();
  });

  it("opens the authenticated shell after a successful login", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Promise.resolve(unauthenticatedResponse());
      }
      if (url === "/api/auth/login") {
        return Promise.resolve(response(requesterAuthResponse));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Sign in to your service desk",
    });
    await user.type(
      screen.getByLabelText(/Email/),
      requesterAuthResponse.user.email,
    );
    await user.type(screen.getByLabelText(/Password/), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeInTheDocument();
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
    expect(screen.queryByText(/Development Requester/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change Requester" }),
    ).not.toBeInTheDocument();
  });

  it("explains an inactive account without exposing credential details", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/me") {
        return Promise.resolve(unauthenticatedResponse());
      }
      return Promise.resolve(
        response(
          { error: { code: "ACCOUNT_INACTIVE", message: "safe inactive" } },
          false,
          403,
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", {
      name: "Sign in to your service desk",
    });
    await user.type(screen.getByLabelText(/Email/), "inactive@example.test");
    await user.type(screen.getByLabelText(/Password/), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account is inactive. Contact an administrator.",
    );
    expect(screen.queryByText("safe inactive")).not.toBeInTheDocument();
  });
});
