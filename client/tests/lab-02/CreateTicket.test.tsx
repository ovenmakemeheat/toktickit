import { cleanup, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";

type MockResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

const activeRequesters = [
  { id: 1, name: "Requester A", email: "requester-a@toktickit.test" },
];

const categories = [
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
];

const relatedSystems = [
  { id: 4, name: "VPN" },
  { id: 5, name: "Email" },
];

const createdTicket = {
  id: 101,
  ticketNumber: "TT-20260827-ABC123",
  ticketDate: "2026-08-27T09:00:00.000Z",
  requester: { id: 1, name: "Requester A" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 4, name: "VPN" },
  requestedPriority: "HIGH",
  summary: "VPN connection fails",
  description: "The VPN connection fails after entering the credentials.",
  currentStatus: "NEW",
  createdAt: "2026-08-27T09:00:00.000Z",
  lastUpdated: "2026-08-27T09:00:00.000Z",
  attachments: [],
};

function response(body: unknown, ok = true): MockResponse {
  return { ok, json: async () => body };
}

function setupFetch(
  createResponse: MockResponse | Promise<MockResponse> = response(
    createdTicket,
  ),
) {
  const fetchMock = vi.fn(
    (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = String(input);
      if (url === "/api/development-requesters") {
        return Promise.resolve(response(activeRequesters));
      }
      if (url === "/api/categories") {
        return Promise.resolve(response(categories));
      }
      if (url === "/api/related-systems") {
        return Promise.resolve(response(relatedSystems));
      }
      if (url === "/api/tickets") {
        return Promise.resolve(createResponse);
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openCreateTicket(user: UserEvent) {
  render(<App />);
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Development Requester" }),
    "1",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Create Ticket" }));
  await screen.findByRole("heading", { name: "Create Ticket" });
  await screen.findByRole("combobox", { name: "Category" });
}

async function fillValidTicket(user: UserEvent) {
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Category" }),
    "2",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Related System" }),
    "4",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Requested Priority" }),
    "HIGH",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "VPN connection fails",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Description" }),
    "The VPN connection fails after entering the credentials.",
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Issue #53 Create Ticket", () => {
  it("shows a loading state before active reference controls are ready", async () => {
    let resolveCategories!: (value: MockResponse) => void;
    const categoriesPromise = new Promise<MockResponse>((resolve) => {
      resolveCategories = resolve;
    });
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, _options?: RequestInit) => {
        const url = String(input);
        if (url === "/api/development-requesters") {
          return Promise.resolve(response(activeRequesters));
        }
        if (url === "/api/categories") {
          return categoriesPromise;
        }
        if (url === "/api/related-systems") {
          return Promise.resolve(response(relatedSystems));
        }
        return Promise.resolve(response(createdTicket));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Development Requester" }),
      "1",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading Categories and Related Systems...",
    );
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();

    resolveCategories(response(categories));
    expect(await screen.findByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("shows field validation and does not call the create API for an empty form", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    await openCreateTicket(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Category is required.")).toBeInTheDocument();
    expect(screen.getByText("Related System is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Requested Priority is required."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Summary must contain/)).toBeInTheDocument();
    expect(screen.getByText(/Description must contain/)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/tickets",
      ),
    ).toHaveLength(0);
  });

  it("submits one valid ticket with requester context and shows the generated number", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    await openCreateTicket(user);
    await fillValidTicket(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Ticket created: TT-20260827-ABC123"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("2026-08-27T09:00:00.000Z"),
    ).toBeInTheDocument();

    const ticketCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/tickets",
    );
    expect(ticketCall).toBeDefined();
    const options = ticketCall?.[1] as RequestInit;
    expect(options.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "X-Development-Requester-Id": "1",
      }),
    );
    expect(JSON.parse(String(options.body))).toEqual({
      clientRequestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      categoryId: 2,
      relatedSystemId: 4,
      requestedPriority: "HIGH",
      summary: "VPN connection fails",
      description: "The VPN connection fails after entering the credentials.",
    });
  });

  it("disables Submit and prevents duplicate requests while busy", async () => {
    let resolveCreate!: (value: MockResponse) => void;
    const createPromise = new Promise<MockResponse>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = setupFetch(createPromise);
    const user = userEvent.setup();
    await openCreateTicket(user);
    await fillValidTicket(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      screen.getByRole("button", { name: "Submitting..." }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Submitting..." }));

    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/tickets",
      ),
    ).toHaveLength(1);
    resolveCreate(response(createdTicket));
    expect(await screen.findByText(/Ticket created:/)).toBeInTheDocument();
  });

  it("preserves entered values after a safe API failure", async () => {
    const fetchMock = setupFetch(
      response(
        { error: { code: "TICKET_CREATE_FAILED", message: "internal" } },
        false,
      ),
    );
    const user = userEvent.setup();
    await openCreateTicket(user);
    await fillValidTicket(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API",
    );
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue(
      "VPN connection fails",
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
      "The VPN connection fails after entering the credentials.",
    );
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/tickets",
      ),
    ).toHaveLength(1);
  });

  it("rejects unsupported attachments before calling the create API", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    await openCreateTicket(user);
    await fillValidTicket(user);

    await user.upload(
      screen.getByLabelText("Attachments"),
      new File(["notes"], "evidence.png", { type: "image/jpeg" }),
    );
    expect(screen.getByText(/does not match/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      screen.getByText("Remove or replace the rejected attachment(s)."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/tickets",
      ),
    ).toHaveLength(0);
  });
});
