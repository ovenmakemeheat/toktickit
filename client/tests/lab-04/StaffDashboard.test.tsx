import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import { response, sessionResponse } from "../lab-03/test-helpers";

const staffUser = {
  id: 22,
  name: "IT Staff A",
  email: "it-staff-a@toktickit.test",
  role: "IT_STAFF" as const,
  active: true,
  mustChangePassword: false,
};
const dashboard = {
  asOf: "2026-10-11T12:00:00.000Z",
  metrics: {
    unassignedActiveCount: 3,
    myActiveCount: 2,
    highPriorityActiveCount: 1,
    statusBreakdown: {
      NEW: 1,
      OPEN: 2,
      IN_PROGRESS: 1,
      WAITING_FOR_REQUESTER: 1,
      REOPENED: 0,
    },
    itPriorityBreakdown: { LOW: 1, MEDIUM: 3, HIGH: 1 },
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
      itPriority: "HIGH",
      owner: { id: 22, name: "IT Staff A", role: "IT_STAFF" },
    },
  ],
  myRecentActions: [
    {
      id: 47,
      ticketId: 316,
      ticketNumber: "TT-20261010-DEF456",
      ticketSummary: "Printer queue recovered",
      actionDescription: "Cleared the stuck print job.",
      result: "New print jobs completed successfully.",
      createdAt: "2026-10-10T11:00:00.000Z",
      performedBy: { id: 22, name: "IT Staff A", role: "IT_STAFF" },
    },
  ],
};

function setupFetch(
  options: {
    role?: "IT_STAFF" | "ADMINISTRATOR";
    dashboardResponse?: () => ReturnType<typeof response>;
  } = {},
) {
  let dashboardCalls = 0;
  const role = options.role ?? "IT_STAFF";
  const user = {
    ...staffUser,
    name: role === "ADMINISTRATOR" ? "Administrator" : staffUser.name,
    email:
      role === "ADMINISTRATOR"
        ? "administrator@toktickit.test"
        : staffUser.email,
    role,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/auth/me") {
      return response(sessionResponse(user));
    }
    if (url === "/api/staff/dashboard") {
      dashboardCalls += 1;
      return options.dashboardResponse?.() ?? response(dashboard);
    }
    if (url === "/api/categories" || url === "/api/related-systems") {
      return response([]);
    }
    if (url.startsWith("/api/staff/tickets?")) {
      return response({
        items: [],
        eligibleOwners: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      });
    }
    if (url.startsWith("/api/staff/tickets/")) {
      return response({
        id: 316,
        ticketNumber: "TT-20261010-DEF456",
        ticketDate: "2026-10-10T09:00:00.000Z",
        requester: { id: 11, name: "Requester A" },
        category: { id: 1, name: "Software" },
        relatedSystem: { id: 1, name: "Email" },
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        summary: "Printer queue recovered",
        description: "Description",
        currentStatus: "CLOSED",
        owner: { id: 22, name: "IT Staff A", role: "IT_STAFF" },
        requesterResolutionIndicatedAt: null,
        resolvedAt: "2026-10-10T10:00:00.000Z",
        hasEligibleResolutionAction: true,
        createdAt: "2026-10-10T09:00:00.000Z",
        updatedAt: "2026-10-10T10:00:00.000Z",
        attachments: [],
        publicComments: [],
        internalNotes: [],
      });
    }
    if (url.endsWith("/actions-taken")) {
      return response([]);
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

describe("Lab 4 Staff Dashboard", () => {
  it("shows active metrics and opens the Queue with its dashboard filters intact", async () => {
    const { fetchMock } = setupFetch();
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Staff Dashboard" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Unassigned Active: 3/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /My Active Tickets: 2/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /View Reopened Tickets: 0/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "My Recent Actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cleared the stuck print job."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Result: New print jobs completed successfully."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Unassigned Active: 3/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Ticket Queue" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/staff/tickets");
    expect(window.location.search).toBe("?statusGroup=ACTIVE&owner=unassigned");
    expect(screen.getByLabelText("Status")).toHaveValue("ACTIVE");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input]) =>
            String(input).includes("statusGroup=ACTIVE") &&
            String(input).includes("owner=unassigned"),
        ),
      ).toBe(true),
    );
  });

  it("opens My Recent Actions at the matching Action Taken anchor", async () => {
    setupFetch();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Staff Dashboard" });
    await user.click(
      await screen.findByRole("button", {
        name: /Open Action Taken on Ticket TT-20261010-DEF456/,
      }),
    );

    expect(window.location.pathname).toBe("/staff/tickets/316");
    expect(window.location.hash).toBe("#action-taken-47");
  });

  it("gives Administrators the same operational dashboard and retains admin destinations", async () => {
    setupFetch({ role: "ADMINISTRATOR" });
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Staff Dashboard" }),
    ).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", {
      name: "Application navigation",
    });
    expect(
      within(navigation).getByRole("button", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(navigation).getByRole("button", { name: "Ticket Queue" }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole("button", { name: "User Management" }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole("button", { name: "Ticket Review" }),
    ).toBeInTheDocument();
  });

  it("shows safe retry feedback and a successful zero-data state", async () => {
    let attempts = 0;
    setupFetch({
      dashboardResponse: () => {
        attempts += 1;
        return attempts === 1
          ? response(
              { error: { code: "STAFF_DASHBOARD_FAILED", message: "safe" } },
              false,
              500,
            )
          : response({
              ...dashboard,
              metrics: {
                unassignedActiveCount: 0,
                myActiveCount: 0,
                highPriorityActiveCount: 0,
                statusBreakdown: {
                  NEW: 0,
                  OPEN: 0,
                  IN_PROGRESS: 0,
                  WAITING_FOR_REQUESTER: 0,
                  REOPENED: 0,
                },
                itPriorityBreakdown: { LOW: 0, MEDIUM: 0, HIGH: 0 },
              },
              recentlyUpdated: [],
              myRecentActions: [],
            });
      },
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API",
    );
    await user.click(screen.getByRole("button", { name: "Retry Dashboard" }));
    expect(
      await screen.findByText("No active Tickets need attention right now."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No Actions Taken by you in the last 30 days."),
    ).toBeInTheDocument();
  });
});
