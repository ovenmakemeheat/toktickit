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
import {
  requesterAuthResponse,
  response,
  type MockResponse,
} from "../lab-03/test-helpers";

const categories = [
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
];

const relatedSystems = [
  { id: 4, name: "VPN" },
  { id: 5, name: "Email" },
];

const ownedTicket = {
  id: 101,
  ticketNumber: "TT-20260829-ABC123",
  ticketDate: "2026-08-29T09:00:00.000Z",
  requester: { id: 11, name: "Requester A" },
  category: categories[0],
  relatedSystem: relatedSystems[0],
  requestedPriority: "HIGH",
  summary: "VPN connection fails",
  currentStatus: "NEW",
  lastUpdated: "2026-08-29T09:05:00.000Z",
};

const ownedTicketDetail = {
  ...ownedTicket,
  description: "The VPN connection fails after entering the credentials.",
  createdAt: "2026-08-29T09:00:00.000Z",
  attachments: [],
};

const listWithTicket = {
  items: [ownedTicket],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
};

const initialList = {
  ...listWithTicket,
  items: [{ ...ownedTicket, summary: "Initial response" }],
};

const latestList = {
  ...listWithTicket,
  items: [{ ...ownedTicket, summary: "Latest response" }],
};

const emptyList = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
};

function setupFetch(
  ticketResponse:
    | MockResponse
    | Promise<MockResponse>
    | ((
        url: string,
        options: RequestInit | undefined,
      ) => MockResponse | Promise<MockResponse>),
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/api/auth/me") {
      return Promise.resolve(response(requesterAuthResponse));
    }
    if (url === "/api/categories") {
      return Promise.resolve(response(categories));
    }
    if (url === "/api/related-systems") {
      return Promise.resolve(response(relatedSystems));
    }
    if (url.startsWith("/api/tickets")) {
      const nextResponse =
        typeof ticketResponse === "function"
          ? ticketResponse(url, options)
          : ticketResponse;
      return Promise.resolve(nextResponse);
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openMyTickets(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  const navigation = await screen.findByRole("navigation", {
    name: "Application navigation",
  });
  await user.click(
    within(navigation).getByRole("button", { name: "My Tickets" }),
  );
  await screen.findByRole("heading", { name: "My Tickets" });
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Lab 3 authenticated My Tickets", () => {
  it("shows loading, authenticated results, and the documented ticket fields", async () => {
    let resolveTickets!: (value: MockResponse) => void;
    const ticketsPromise = new Promise<MockResponse>((resolve) => {
      resolveTickets = resolve;
    });
    const fetchMock = setupFetch(ticketsPromise);
    const user = userEvent.setup();

    await openMyTickets(user);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Tickets...");

    resolveTickets(response(listWithTicket));
    expect(await screen.findAllByText("VPN connection fails")).not.toHaveLength(
      0,
    );
    expect(
      screen.getByText(/Tickets owned by Requester A/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Hardware")).not.toHaveLength(0);
    expect(screen.getAllByText("High")).not.toHaveLength(0);
    expect(screen.getAllByText("New")).not.toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: "Open Ticket" }),
    ).not.toHaveLength(0);

    const ticketCall = fetchMock.mock.calls.find(([input]) =>
      String(input).startsWith("/api/tickets"),
    );
    expect(ticketCall).toBeDefined();
    const ticketOptions = ticketCall?.[1] as RequestInit | undefined;
    expect(
      new Headers(ticketOptions?.headers).get("X-Development-Requester-Id"),
    ).toBeNull();
    expect(String(ticketCall?.[0])).toContain("page=1");
    expect(String(ticketCall?.[0])).toContain("pageSize=10");
  });

  it("distinguishes an empty requester list from a no-results query and clears filters", async () => {
    const fetchMock = setupFetch(response(emptyList));
    const user = userEvent.setup();

    await openMyTickets(user);
    expect(
      await screen.findByText("Requester A has no tickets yet."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Create Ticket" }),
    ).not.toHaveLength(0);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "VPN");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(
        "No tickets match the current search and filters.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Clear Filters" }),
    ).not.toHaveLength(0);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("search=VPN"),
      ),
    ).toBe(true);

    await user.click(
      screen.getAllByRole("button", { name: "Clear Filters" })[0],
    );
    expect(
      await screen.findByText("Requester A has no tickets yet."),
    ).toBeInTheDocument();
  });

  it("opens a ticket detail view from the result action", async () => {
    const fetchMock = setupFetch((url) =>
      url === "/api/tickets/101"
        ? response(ownedTicketDetail)
        : response(listWithTicket),
    );
    const user = userEvent.setup();

    await openMyTickets(user);
    await screen.findAllByText("VPN connection fails");

    await user.click(screen.getAllByRole("button", { name: "Open Ticket" })[0]);

    expect(
      await screen.findByRole("heading", { name: "TT-20260829-ABC123" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tickets/101",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("exposes a recoverable failure without showing stale results", async () => {
    let attempts = 0;
    const fetchMock = setupFetch(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("network unavailable"))
        : response(listWithTicket);
    });
    const user = userEvent.setup();

    await openMyTickets(user);
    expect(
      await screen.findByText(
        /Your current ticket list was not kept as current/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("VPN connection fails")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("VPN connection fails")).not.toHaveLength(
      0,
    );
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/api/tickets"),
      ),
    ).toHaveLength(2);
  });

  it("ignores an older list response after the query changes", async () => {
    let resolveInitial!: (value: MockResponse) => void;
    let resolveLatest!: (value: MockResponse) => void;
    const initialResponse = new Promise<MockResponse>((resolve) => {
      resolveInitial = resolve;
    });
    const latestResponse = new Promise<MockResponse>((resolve) => {
      resolveLatest = resolve;
    });
    const fetchMock = setupFetch((url) =>
      url.includes("search=VPN") ? latestResponse : initialResponse,
    );
    const user = userEvent.setup();

    await openMyTickets(user);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).startsWith("/api/tickets"),
        ),
      ).toHaveLength(1),
    );

    await user.type(screen.getByRole("textbox", { name: "Search" }), "VPN");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).startsWith("/api/tickets"),
        ),
      ).toHaveLength(2),
    );

    resolveLatest(response(latestList));
    expect(await screen.findAllByText("Latest response")).not.toHaveLength(0);

    resolveInitial(response(initialList));
    await waitFor(() =>
      expect(screen.queryByText("Initial response")).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText("Latest response")).not.toHaveLength(0);
  });
});
