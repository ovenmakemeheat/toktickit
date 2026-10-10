import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import StaffTicketDetail from "../../src/lab-03/StaffTicketDetail";
import type { StaffTicketDetail as StaffTicketDetailType } from "../../src/lib/api";
import { response, sessionResponse } from "../lab-03/test-helpers";

const ticket: StaffTicketDetailType = {
  id: 811,
  ticketNumber: "TT-20261008-ADMIN01",
  ticketDate: "2026-10-08T08:00:00.000Z",
  requester: { id: 11, name: "Requester A" },
  category: { id: 1, name: "Software" },
  relatedSystem: { id: 2, name: "Email" },
  requestedPriority: "HIGH",
  itPriority: "MEDIUM",
  summary: "Cannot access course email",
  description: "The browser shows an authentication error after sign-in.",
  currentStatus: "OPEN",
  owner: null,
  eligibleOwners: [{ id: 31, name: "Administrator", role: "ADMINISTRATOR" }],
  requesterResolutionIndicatedAt: null,
  resolvedAt: null,
  hasEligibleResolutionAction: false,
  createdAt: "2026-10-08T08:00:00.000Z",
  updatedAt: "2026-10-08T08:00:00.000Z",
  attachments: [],
  publicComments: [
    {
      id: 901,
      author: { id: 11, name: "Requester A", role: "REQUESTER" },
      content: "I can sign in now, thank you.",
      createdAt: "2026-10-08T08:30:00.000Z",
    },
  ],
  internalNotes: [
    {
      id: 902,
      author: { id: 21, name: "IT Staff A", role: "IT_STAFF" },
      content: "Identity provider response needs review.",
      createdAt: "2026-10-08T08:31:00.000Z",
    },
  ],
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Administrator Ticket operations", () => {
  it("allows operational work and Actions Taken while keeping communications read-only", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (
        url === "/api/staff/tickets/811" &&
        (!init?.method || init.method === "GET")
      ) {
        return Promise.resolve(response(ticket));
      }
      if (url === "/api/tickets/811/actions-taken") {
        return Promise.resolve(response({ items: [] }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <StaffTicketDetail
        ticketId={811}
        onBack={vi.fn()}
        isAdministrator
        canWriteCommunications={false}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "TT-20261008-ADMIN01" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toBeInTheDocument();
    expect(
      screen.getByText("I can sign in now, thank you."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Identity provider response needs review."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Communications are read-only for Administrators/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Add Public Comment"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Add Internal Note"),
    ).not.toBeInTheDocument();

    const status = screen.getByLabelText("Status");
    expect(
      within(status).getByRole("option", {
        name: "Resolved (record an Action Taken first)",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Record an Action Taken after the latest reopen before resolving.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Action Taken" }));
    expect(screen.getByLabelText("Action Description")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Performed by/)).not.toBeInTheDocument();
  });

  it("routes Administrator navigation into the operational Ticket Queue", async () => {
    const queue = {
      items: [],
      eligibleOwners: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 1,
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Promise.resolve(
          response(
            sessionResponse({ role: "ADMINISTRATOR", name: "Administrator" }),
          ),
        );
      }
      if (url.startsWith("/api/staff/tickets")) {
        return Promise.resolve(response(queue));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Ticket Queue" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Ticket Queue" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/staff/tickets");
    expect(
      screen.getByRole("button", { name: "User Management" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ticket Review" }),
    ).toBeInTheDocument();
  });
});
