import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import "../../src/index.css";

type MockResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

const activeRequesters = [
  { id: 1, name: "Requester A", email: "requester-a@toktickit.test" },
];

const categories = [{ id: 2, name: "Hardware" }];
const relatedSystems = [{ id: 4, name: "VPN" }];
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

const emptyTicketList = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
};

function response(body: unknown, ok = true): MockResponse {
  return { ok, json: async () => body };
}

function setupFetch(
  createResponse: MockResponse | Promise<MockResponse> = response(
    createdTicket,
  ),
  ticketListResponse: MockResponse | Promise<MockResponse> = response(
    emptyTicketList,
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
      if (url.startsWith("/api/tickets?")) {
        return Promise.resolve(ticketListResponse);
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
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Issue #57 Zen Green responsive contract", () => {
  it("exposes the approved tokens and accessible shared control states", async () => {
    setupFetch();
    const user = userEvent.setup();

    await openCreateTicket(user);

    const rootStyles = getComputedStyle(document.documentElement);
    expect(rootStyles.getPropertyValue("--zen-primary").trim()).toBe("#006b3c");
    expect(rootStyles.getPropertyValue("--zen-secondary").trim()).toBe(
      "#0b7a46",
    );
    expect(rootStyles.getPropertyValue("--zen-pale").trim()).toBe("#eaf6ef");

    expect(
      screen.getByRole("button", { name: "Create Ticket" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Ticket Number")).toHaveClass(
      "form-control",
      "lab2-readonly",
    );
    expect(screen.getByLabelText("Ticket Number")).toHaveAttribute(
      "aria-readonly",
      "true",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toHaveClass(
      "btn-success",
    );
    expect(
      screen.getByRole("button", { name: "Back to requester summary" }),
    ).toHaveClass("btn-outline-secondary");
    expect(screen.getByRole("combobox", { name: "Category" })).toBeRequired();
    expect(
      screen
        .getByText("Category", { exact: true })
        .querySelector('[aria-hidden="true"]'),
    ).not.toBeNull();

    screen.getByRole("textbox", { name: "Summary" }).focus();
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveFocus();
  });

  it("exposes field-level invalid state through accessible relationships", async () => {
    setupFetch();
    const user = userEvent.setup();
    await openCreateTicket(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const category = screen.getByRole("combobox", { name: "Category" });
    expect(category).toHaveAttribute("aria-invalid", "true");
    expect(category).toHaveAttribute("aria-describedby", "categoryId-error");
    expect(screen.getByText("Category is required.")).toHaveClass(
      "lab2-field-error",
    );
    expect(screen.getByText("Category is required.")).toHaveAttribute(
      "role",
      "alert",
    );
  });

  it("marks the current requester page in the navigation", async () => {
    setupFetch(response(createdTicket), response(emptyTicketList));
    const user = userEvent.setup();

    await openCreateTicket(user);
    await user.click(screen.getByRole("button", { name: "My Tickets" }));
    await screen.findByRole("heading", { name: "My Tickets" });

    const navigation = within(
      screen.getByRole("navigation", { name: "Requester navigation" }),
    );
    expect(
      navigation.getByRole("button", { name: "My Tickets" }),
    ).toHaveAttribute("aria-current", "page");
    expect(navigation.getByRole("button", { name: "My Tickets" })).toHaveClass(
      "btn-success",
    );
    expect(
      navigation.getByRole("button", { name: "Create Ticket" }),
    ).toHaveClass("btn-outline-success");
  });

  it("exposes busy and success states without allowing duplicate submission", async () => {
    let resolveCreate!: (value: MockResponse) => void;
    const createPromise = new Promise<MockResponse>((resolve) => {
      resolveCreate = resolve;
    });
    setupFetch(createPromise);
    const user = userEvent.setup();
    await openCreateTicket(user);
    await fillValidTicket(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const submittingButton = screen.getByRole("button", {
      name: "Submitting...",
    });
    expect(submittingButton).toBeDisabled();
    expect(submittingButton).toHaveClass("btn-success");

    resolveCreate(response(createdTicket));

    const successState = await screen.findByRole("status");
    expect(successState).toHaveClass("lab2-state", "lab2-state-success");
    expect(successState).toHaveAttribute("aria-live", "polite");
    expect(successState).toHaveTextContent(
      "Ticket created: TT-20260827-ABC123",
    );
  });
});
