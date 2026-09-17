import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminTicketReview from "../../src/lab-03/AdminTicketReview";
import { response } from "./test-helpers";

const detail = {
  id: 42,
  ticketNumber: "TT-20260910-ABC123",
  ticketDate: "2026-09-10T10:30:00.000Z",
  requester: { id: 11, name: "Requester A" },
  category: { id: 1, name: "Software" },
  relatedSystem: { id: 2, name: "Email" },
  requestedPriority: "HIGH" as const,
  itPriority: "MEDIUM" as const,
  summary: "Cannot access course email",
  description: "The browser shows an authentication error after sign-in.",
  currentStatus: "OPEN" as const,
  owner: { id: 20, name: "IT Staff A", role: "IT_STAFF" as const },
  requesterResolutionIndicatedAt: "2026-09-10T11:30:00.000Z",
  createdAt: "2026-09-10T10:30:00.000Z",
  updatedAt: "2026-09-10T11:35:00.000Z",
  attachments: [
    {
      id: 5,
      displayName: "error.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      uploadedAt: "2026-09-10T10:40:00.000Z",
      removedAt: null,
      removalReason: null,
      isActive: true,
      downloadUrl: null,
    },
  ],
  publicComments: [
    {
      id: 1,
      author: { id: 20, name: "IT Staff A", role: "IT_STAFF" as const },
      content: "Please try the documented sign-in again.",
      createdAt: "2026-09-10T10:40:00.000Z",
    },
  ],
  internalNotes: [
    {
      id: 2,
      author: { id: 20, name: "IT Staff A", role: "IT_STAFF" as const },
      content: "Private triage detail",
      createdAt: "2026-09-10T10:45:00.000Z",
    },
  ],
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Administrator Ticket Review", () => {
  it("shows read-only Ticket facts and only permits IT Priority changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (
        url === "/api/admin/tickets/42/priority" &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve(
          response({ ...detail, itPriority: "LOW" as const }),
        );
      }
      if (url === "/api/admin/tickets/42") {
        return Promise.resolve(response(detail));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(<AdminTicketReview ticketId={42} onBack={onBack} />);

    expect(
      await screen.findByRole("heading", { name: "TT-20260910-ABC123" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Requester")).toHaveValue("Requester A");
    expect(screen.getByLabelText("Requested Priority")).toHaveValue("High");
    expect(screen.getByLabelText("Current Status")).toHaveValue("Open");
    expect(screen.getByLabelText("Owner")).toHaveValue("IT Staff A");
    expect(screen.getByText("Private triage detail")).toBeInTheDocument();
    expect(screen.getByText("error.png")).toBeInTheDocument();
    expect(screen.getByText(/Problem appears resolved/)).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Claim" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reassign" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Update status" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Post public comment" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add internal note" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
    await user.click(screen.getByRole("button", { name: "Save IT Priority" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input) === "/api/admin/tickets/42/priority" &&
            init?.method === "PATCH" &&
            typeof init.body === "string" &&
            JSON.parse(init.body).itPriority === "LOW",
        ),
      ).toBe(true);
    });
    expect(
      await screen.findByText("IT Priority updated successfully."),
    ).toBeInTheDocument();
  });

  it("opens a known Ticket from the review entry screen and validates the ID", async () => {
    const user = userEvent.setup();
    render(<AdminTicketReview onBack={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Administrator Ticket Review" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Open Ticket Review" }),
    );
    expect(screen.getByText("Enter a positive Ticket ID.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Ticket ID/), "42");
    await user.click(
      screen.getByRole("button", { name: "Open Ticket Review" }),
    );
    expect(window.location.pathname).toBe("/admin/tickets/42");
  });

  it("shows safe forbidden and retry feedback", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response(
          {
            error: {
              code: "ADMIN_TICKET_FORBIDDEN",
              message: "forbidden",
            },
          },
          false,
          403,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onBack = vi.fn();
    render(<AdminTicketReview ticketId={42} onBack={onBack} />);

    expect(
      await screen.findByText(
        "Administrator permission is required to review Tickets.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Back to User Management" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
