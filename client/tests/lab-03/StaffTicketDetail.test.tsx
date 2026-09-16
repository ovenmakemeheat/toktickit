import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffTicketDetail from "../../src/lab-03/StaffTicketDetail";
import type {
  StaffTicketDetail as StaffTicketDetailType,
  TicketCommunicationEntry,
} from "../../src/lib/api";
import { response } from "./test-helpers";

const attachment = {
  id: 301,
  displayName: "error.png",
  mimeType: "image/png",
  sizeBytes: 2_048,
  uploadedAt: "2026-09-10T10:45:00.000Z",
  removedAt: null,
  removalReason: null,
  isActive: true,
  downloadUrl: null,
};

const publicComment = {
  id: 401,
  author: { id: 21, name: "IT Staff A", role: "IT_STAFF" },
  content: "Please try the documented browser sign-in again.",
  createdAt: "2026-09-10T10:40:00.000Z",
} satisfies TicketCommunicationEntry;

const internalNote = {
  id: 402,
  author: { id: 21, name: "IT Staff A", role: "IT_STAFF" },
  content: "Identity provider response needs review.",
  createdAt: "2026-09-10T10:41:00.000Z",
} satisfies TicketCommunicationEntry;

const ticket = {
  id: 101,
  ticketNumber: "TT-20260910-QUEUE01",
  ticketDate: "2026-09-10T10:30:00.000Z",
  requester: { id: 11, name: "Requester A" },
  category: { id: 1, name: "Software" },
  relatedSystem: { id: 2, name: "Email" },
  requestedPriority: "HIGH",
  itPriority: "MEDIUM",
  summary: "Cannot access course email",
  description: "The browser shows an authentication error after sign-in.",
  currentStatus: "OPEN",
  owner: null,
  requesterResolutionIndicatedAt: null,
  createdAt: "2026-09-10T10:30:00.000Z",
  updatedAt: "2026-09-10T10:35:00.000Z",
  attachments: [attachment],
  publicComments: [publicComment],
  internalNotes: [internalNote],
} satisfies StaffTicketDetailType;

function installDetailFetch() {
  let currentTicket: StaffTicketDetailType = ticket;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (
      url === "/api/staff/tickets/101" &&
      (!init?.method || init.method === "GET")
    ) {
      return Promise.resolve(response(currentTicket));
    }
    if (url === "/api/staff/tickets/101/claim") {
      currentTicket = {
        ...currentTicket,
        owner: { id: 21, name: "IT Staff A", role: "IT_STAFF" },
      };
      return Promise.resolve(response(currentTicket));
    }
    if (url === "/api/staff/tickets/101/priority") {
      currentTicket = { ...currentTicket, itPriority: "LOW" };
      return Promise.resolve(response(currentTicket));
    }
    if (url === "/api/staff/tickets/101/status") {
      currentTicket = { ...currentTicket, currentStatus: "IN_PROGRESS" };
      return Promise.resolve(response(currentTicket));
    }
    if (url === "/api/tickets/101/comments") {
      return Promise.resolve(response(publicComment));
    }
    if (url === "/api/tickets/101/internal-notes") {
      return Promise.resolve(response(internalNote));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("IT Staff Ticket Detail", () => {
  it("shows read-only facts, private/public communication, attachments, and operations", async () => {
    installDetailFetch();
    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);

    expect(
      await screen.findByRole("heading", { name: "TT-20260910-QUEUE01" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Summary")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("IT Priority")).toHaveValue("MEDIUM");
    expect(screen.getByText("Public Comments")).toBeInTheDocument();
    expect(screen.getByText("Internal Notes")).toBeInTheDocument();
    expect(screen.getByText(/Visible only to IT Staff/)).toBeInTheDocument();
    expect(
      screen.getByText("Identity provider response needs review."),
    ).toBeInTheDocument();
    expect(screen.getByText("error.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("shows refresh feedback for a concurrent status conflict", async () => {
    let detailLoads = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (
        url === "/api/staff/tickets/101" &&
        (!init?.method || init.method === "GET")
      ) {
        detailLoads += 1;
        return Promise.resolve(response(ticket));
      }
      if (url === "/api/staff/tickets/101/status") {
        return Promise.resolve(
          response(
            {
              error: {
                code: "TICKET_STATUS_CONFLICT",
                message:
                  "The Ticket status changed before this operation completed",
              },
            },
            false,
            409,
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TT-20260910-QUEUE01" });

    await user.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await user.click(screen.getByRole("button", { name: "Update status" }));

    expect(
      await screen.findByText(
        "This Ticket status changed elsewhere. Refresh before trying again.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh Ticket" }));
    await waitFor(() => expect(detailLoads).toBe(2));
  });

  it("requires status confirmation and submits permitted mutations", async () => {
    const fetchMock = installDetailFetch();
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TT-20260910-QUEUE01" });

    await user.click(screen.getByRole("button", { name: "Claim" }));
    expect(
      await screen.findByText("Ticket claimed successfully."),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
    await user.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect(
      await screen.findByText("IT Priority updated successfully."),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(
      await screen.findByText("Ticket status updated successfully."),
    ).toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input) === "/api/staff/tickets/101/status" &&
          init?.method === "PATCH",
      ),
    ).toBe(true);
  });
});
