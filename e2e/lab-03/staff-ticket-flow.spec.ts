import { expect, test, type Page } from "@playwright/test";

type Route = Parameters<Parameters<Page["route"]>[1]>[0];
type Priority = "LOW" | "MEDIUM" | "HIGH";
type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";
type Owner = {
  id: number;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
};

type Communication = {
  id: number;
  author: Owner;
  content: string;
  createdAt: string;
};

const staff = {
  id: 21,
  name: "IT Staff A",
  email: "it-staff-a@toktickit.test",
  role: "IT_STAFF" as const,
  active: true,
  mustChangePassword: false,
};

const owners: Owner[] = [
  staff,
  { id: 31, name: "Administrator", role: "ADMINISTRATOR" },
];

const requester = { id: 11, name: "Requester A" };
const category = { id: 1, name: "Software" };
const relatedSystem = { id: 2, name: "Email" };
const ticketId = 101;
const ticketNumber = "TT-20260919-STAFF01";

const publicComments: Communication[] = [
  {
    id: 401,
    author: staff,
    content: "Please try the documented browser sign-in again.",
    createdAt: "2026-09-19T10:40:00.000Z",
  },
];
const internalNotes: Communication[] = [
  {
    id: 402,
    author: staff,
    content: "Identity provider response needs review.",
    createdAt: "2026-09-19T10:41:00.000Z",
  },
];

const queueTicket = {
  id: ticketId,
  ticketNumber,
  ticketDate: "2026-09-19T10:30:00.000Z",
  requester,
  category,
  relatedSystem,
  requestedPriority: "HIGH" as const,
  itPriority: "MEDIUM" as const,
  summary: "Cannot access course email",
  currentStatus: "OPEN" as const,
  owner: null,
  lastUpdated: "2026-09-19T10:35:00.000Z",
};

function authResponse() {
  return {
    user: staff,
    session: { expiresAt: "2026-09-20T17:00:00.000Z" },
    csrfToken: "csrf-token",
  };
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function mockStaffWorkflow(page: Page) {
  let owner: Owner | null = null;
  let itPriority: Priority = "MEDIUM";
  let currentStatus: TicketStatus = "OPEN";
  let nextCommunicationId = 500;

  const detail = () => ({
    ...queueTicket,
    owner,
    itPriority,
    currentStatus,
    eligibleOwners: owners,
    description: "The browser shows an authentication error after sign-in.",
    requesterResolutionIndicatedAt: null,
    createdAt: "2026-09-19T10:30:00.000Z",
    updatedAt: "2026-09-19T10:35:00.000Z",
    attachments: [
      {
        id: 301,
        displayName: "error.png",
        mimeType: "image/png",
        sizeBytes: 2_048,
        uploadedAt: "2026-09-19T10:45:00.000Z",
        removedAt: null,
        removalReason: null,
        isActive: true,
        downloadUrl: null,
      },
    ],
    publicComments,
    internalNotes,
  });

  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse()),
  );
  await page.route("**/api/categories", (route) =>
    fulfillJson(route, [category]),
  );
  await page.route("**/api/related-systems", (route) =>
    fulfillJson(route, [relatedSystem]),
  );
  await page.route("**/api/staff/tickets**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/staff/tickets" && request.method() === "GET") {
      await fulfillJson(route, {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        eligibleOwners: owners,
        items: [{ ...queueTicket, owner }],
      });
      return;
    }

    if (
      url.pathname === `/api/staff/tickets/${ticketId}` &&
      request.method() === "GET"
    ) {
      await fulfillJson(route, detail());
      return;
    }

    if (
      url.pathname === `/api/staff/tickets/${ticketId}/claim` &&
      request.method() === "POST"
    ) {
      owner = staff;
      await fulfillJson(route, detail());
      return;
    }

    if (
      url.pathname === `/api/staff/tickets/${ticketId}/owner` &&
      request.method() === "PATCH"
    ) {
      const body = JSON.parse(request.postData() ?? "{}");
      owner = owners.find((candidate) => candidate.id === body.ownerId) ?? null;
      await fulfillJson(route, detail());
      return;
    }

    if (
      url.pathname === `/api/staff/tickets/${ticketId}/priority` &&
      request.method() === "PATCH"
    ) {
      const body = JSON.parse(request.postData() ?? "{}");
      itPriority = body.itPriority as Priority;
      await fulfillJson(route, detail());
      return;
    }

    if (
      url.pathname === `/api/staff/tickets/${ticketId}/status` &&
      request.method() === "PATCH"
    ) {
      const body = JSON.parse(request.postData() ?? "{}");
      currentStatus = body.status as TicketStatus;
      await fulfillJson(route, detail());
      return;
    }

    await fulfillJson(
      route,
      { error: { code: "NOT_FOUND", message: "Route not found." } },
      404,
    );
  });
  await page.route("**/api/tickets/*/comments", async (route) => {
    if (route.request().method() !== "POST") {
      await fulfillJson(route, publicComments);
      return;
    }
    const body = JSON.parse(route.request().postData() ?? "{}");
    publicComments.push({
      id: nextCommunicationId++,
      author: staff,
      content: body.content,
      createdAt: "2026-09-19T11:00:00.000Z",
    });
    await fulfillJson(route, publicComments.at(-1), 201);
  });
  await page.route("**/api/tickets/*/internal-notes", async (route) => {
    if (route.request().method() !== "POST") {
      await fulfillJson(route, internalNotes);
      return;
    }
    const body = JSON.parse(route.request().postData() ?? "{}");
    internalNotes.push({
      id: nextCommunicationId++,
      author: staff,
      content: body.content,
      createdAt: "2026-09-19T11:01:00.000Z",
    });
    await fulfillJson(route, internalNotes.at(-1), 201);
  });
}

test.describe("Lab 3 IT Staff Ticket workflow", () => {
  test("completes queue, ownership, priority, status, and communication operations", async ({
    page,
  }) => {
    await mockStaffWorkflow(page);
    await page.goto("/staff/tickets");

    await expect(
      page.getByRole("heading", { name: "Ticket Queue" }),
    ).toBeVisible();
    await page.getByLabel("Search tickets").fill("course email");
    await page.getByLabel("Status").selectOption("OPEN");
    await expect(
      page.getByRole("button", { name: "Open detail" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open detail" }).first().click();

    await expect(
      page.getByRole("heading", { name: ticketNumber }),
    ).toBeVisible();
    await expect(
      page.getByText("Identity provider response needs review."),
    ).toBeVisible();
    await expect(page.getByText("error.png")).toBeVisible();

    await page.getByRole("button", { name: "Claim" }).click();
    await expect(page.getByText("Ticket claimed successfully.")).toBeVisible();

    await page.getByLabel("Owner").selectOption("31");
    await page.getByRole("button", { name: "Reassign" }).click();
    await expect(
      page.getByText("Ticket owner updated successfully."),
    ).toBeVisible();

    await page.getByLabel("IT Priority").selectOption("LOW");
    await page.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(
      page.getByText("IT Priority updated successfully."),
    ).toBeVisible();

    await page
      .getByLabel("Status", { exact: true })
      .selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(
      page.getByText("Ticket status updated successfully."),
    ).toBeVisible();

    await page
      .getByLabel("Add Public Comment")
      .fill("The browser sign-in now works after the cache was cleared.");
    await page.getByRole("button", { name: "Post public comment" }).click();
    await expect(
      page.getByText(
        "The browser sign-in now works after the cache was cleared.",
      ),
    ).toBeVisible();

    await page
      .getByLabel("Add Internal Note")
      .fill("Validated the identity provider response with the service owner.");
    await page.getByRole("button", { name: "Add internal note" }).click();
    await expect(
      page.getByText(
        "Validated the identity provider response with the service owner.",
      ),
    ).toBeVisible();
  });
});
