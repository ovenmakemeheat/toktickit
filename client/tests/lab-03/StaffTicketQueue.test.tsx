import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffTicketQueue from "../../src/lab-03/StaffTicketQueue";
import { response, type MockResponse } from "./test-helpers";

const queue = {
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  eligibleOwners: [
    { id: 21, name: "IT Staff A", role: "IT_STAFF" },
    { id: 22, name: "IT Staff B", role: "IT_STAFF" },
    { id: 31, name: "Administrator", role: "ADMINISTRATOR" },
  ],
  items: [
    {
      id: 101,
      ticketNumber: "TT-20260910-QUEUE01",
      ticketDate: "2026-09-10T10:30:00.000Z",
      requester: { id: 11, name: "Requester A" },
      category: { id: 1, name: "Software" },
      relatedSystem: { id: 2, name: "Email" },
      requestedPriority: "HIGH",
      itPriority: "MEDIUM",
      summary: "Cannot access course email",
      currentStatus: "OPEN",
      owner: { id: 21, name: "IT Staff A", role: "IT_STAFF" },
      lastUpdated: "2026-09-10T10:35:00.000Z",
    },
  ],
};

function installQueueFetch(queueResponse = queue) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/staff/tickets")) {
      return Promise.resolve(response(queueResponse));
    }
    if (url === "/api/categories") {
      return Promise.resolve(response([{ id: 1, name: "Software" }]));
    }
    if (url === "/api/related-systems") {
      return Promise.resolve(response([{ id: 2, name: "Email" }]));
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

describe("IT Staff Ticket Queue", () => {
  it("renders query controls, operational fields, and opens detail", async () => {
    const onOpenTicket = vi.fn();
    installQueueFetch();
    const user = userEvent.setup();

    render(<StaffTicketQueue onOpenTicket={onOpenTicket} />);

    expect(
      await screen.findByRole("heading", { name: "Ticket Queue" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search tickets")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toBeInTheDocument();
    expect(
      screen.getAllByText("Cannot access course email").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Software / Email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IT Staff A").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "IT Staff B" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Administrator" }),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Open detail" })[0]);
    expect(onOpenTicket).toHaveBeenCalledWith(101);
  });

  it("preserves the requested page when paginating", async () => {
    const fetchMock = installQueueFetch({
      ...queue,
      totalItems: 2,
      totalPages: 2,
    });
    const user = userEvent.setup();

    render(<StaffTicketQueue />);

    await screen.findByRole("heading", { name: "Ticket Queue" });
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("page=2"),
        ),
      ).toBe(true);
    });
  });

  it("keeps the newest queue request in control of loading state", async () => {
    const queueResolvers: Array<(value: MockResponse) => void> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/staff/tickets")) {
        return new Promise<MockResponse>((resolve) => {
          queueResolvers.push(resolve);
        });
      }
      if (url === "/api/categories") {
        return Promise.resolve(response([]));
      }
      if (url === "/api/related-systems") {
        return Promise.resolve(response([]));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<StaffTicketQueue />);
    await waitFor(() => expect(queueResolvers).toHaveLength(1));

    await user.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await waitFor(() => expect(queueResolvers).toHaveLength(2));

    queueResolvers[0]?.(response(queue));
    expect(screen.getByText("Loading Ticket Queue...")).toBeInTheDocument();

    queueResolvers[1]?.(response(queue));
    await waitFor(() =>
      expect(screen.getAllByText("TT-20260910-QUEUE01").length).toBeGreaterThan(
        0,
      ),
    );
  });

  it("explains forbidden and recoverable queue failures", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/staff/tickets")) {
        return Promise.resolve(
          response(
            { error: { code: "STAFF_QUEUE_FORBIDDEN", message: "forbidden" } },
            false,
            403,
          ),
        );
      }
      if (url === "/api/categories") {
        return Promise.resolve(response([]));
      }
      if (url === "/api/related-systems") {
        return Promise.resolve(response([]));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffTicketQueue />);

    expect(
      await screen.findByText(
        "IT Staff access is required to use the Ticket Queue.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
