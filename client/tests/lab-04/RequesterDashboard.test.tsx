import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import {
  requesterAuthResponse,
  response,
  type MockResponse,
} from "../lab-03/test-helpers";

const requesterDashboard = {
  asOf: "2026-10-11T12:00:00.000Z",
  metrics: {
    openCount: 2,
    waitingForRequesterCount: 1,
    recentlyResolvedCount: 1,
  },
  recentlyUpdated: [
    {
      id: 315,
      ticketNumber: "TT-20261011-ABC123",
      summary: "Course email sign-in fails",
      currentStatus: "IN_PROGRESS",
      requestedPriority: "HIGH",
      updatedAt: "2026-10-11T11:00:00.000Z",
      resolvedAt: null,
    },
  ],
  recentlyResolved: [
    {
      id: 316,
      ticketNumber: "TT-20261010-DEF456",
      summary: "Printer queue recovered",
      currentStatus: "CLOSED",
      requestedPriority: "MEDIUM",
      updatedAt: "2026-10-10T11:00:00.000Z",
      resolvedAt: "2026-10-10T10:30:00.000Z",
    },
  ],
};

function setupFetch(
  options: {
    dashboard?: MockResponse | (() => MockResponse | Promise<MockResponse>);
    tickets?: MockResponse;
  } = {},
) {
  let dashboardCalls = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/auth/me") {
      return response(requesterAuthResponse);
    }
    if (url === "/api/requester/dashboard") {
      dashboardCalls += 1;
      if (typeof options.dashboard === "function") {
        return options.dashboard();
      }
      return options.dashboard ?? response(requesterDashboard);
    }
    if (url === "/api/categories" || url === "/api/related-systems") {
      return response([]);
    }
    if (url.startsWith("/api/tickets?")) {
      return (
        options.tickets ??
        response({
          items: [],
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        })
      );
    }
    if (url === "/api/tickets/315" || url === "/api/tickets/316") {
      return response({});
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, dashboardCalls: () => dashboardCalls };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Lab 4 Requester Dashboard", () => {
  it("shows scoped summary cards and recent Ticket details", async () => {
    setupFetch();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Requester Dashboard" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Open Tickets: 2/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Waiting for You: 1/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Recently Resolved")).not.toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /Open Ticket TT-20261011-ABC123/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open Ticket TT-20261010-DEF456/ }),
    ).toBeInTheDocument();

    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: /Open Ticket TT-20261011-ABC123/ }),
      );
    expect(window.location.pathname).toBe("/tickets/315");
  });

  it("preserves the active status group when an Open Tickets card opens My Tickets", async () => {
    const { fetchMock } = setupFetch();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Requester Dashboard" });
    await user.click(
      await screen.findByRole("button", { name: /Open Tickets: 2/ }),
    );

    expect(
      await screen.findByRole("heading", { name: "My Tickets" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/tickets");
    expect(window.location.search).toBe("?statusGroup=ACTIVE");
    expect(screen.getByLabelText("Current Status")).toHaveValue("ACTIVE");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("statusGroup=ACTIVE"),
        ),
      ).toBe(true),
    );
  });

  it("explains API failures and retries without showing stale metrics", async () => {
    let attempts = 0;
    setupFetch({
      dashboard: () => {
        attempts += 1;
        return attempts === 1
          ? response(
              {
                error: { code: "REQUESTER_DASHBOARD_FAILED", message: "safe" },
              },
              false,
              500,
            )
          : response({
              ...requesterDashboard,
              metrics: {
                openCount: 0,
                waitingForRequesterCount: 0,
                recentlyResolvedCount: 0,
              },
              recentlyUpdated: [],
              recentlyResolved: [],
            });
      },
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API",
    );
    expect(screen.getAllByText("—")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Retry Dashboard" }));
    expect(
      await screen.findByText(/No Ticket activity yet/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(3);
  });
});
