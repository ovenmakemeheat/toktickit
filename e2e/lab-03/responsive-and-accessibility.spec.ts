import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const repositoryRoot = resolve(__dirname, "..", "..");
const requesterEvidenceDirectory = resolve(
  repositoryRoot,
  "artifacts",
  "lab-03",
  "screenshots",
  "requester",
);

const requiredViewports = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "tablet", width: 820, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

const requester = {
  id: 11,
  name: "Requester A",
  email: "requester-a@toktickit.test",
  role: "REQUESTER" as const,
  active: true,
  mustChangePassword: false,
};

const requesterTicket = {
  id: 1,
  ticketNumber: "TT-20260918-REQ01",
  ticketDate: "2026-09-18T09:00:00.000Z",
  requester: { id: requester.id, name: requester.name },
  category: { id: 1, name: "Software" },
  relatedSystem: { id: 2, name: "Email" },
  requestedPriority: "HIGH" as const,
  summary: "Cannot access course email",
  description: "The course email account cannot be opened.",
  currentStatus: "OPEN" as const,
  createdAt: "2026-09-18T09:00:00.000Z",
  lastUpdated: "2026-09-18T09:35:00.000Z",
  attachments: [],
};

const staffUser = {
  id: 21,
  name: "IT Staff A",
  email: "it-staff-a@toktickit.test",
  role: "IT_STAFF" as const,
  active: true,
  mustChangePassword: false,
};

const administrator = {
  id: 1,
  name: "Administrator",
  email: "administrator@toktickit.test",
  role: "ADMINISTRATOR" as const,
  active: true,
  mustChangePassword: false,
};

const categories = [{ id: 1, name: "Software" }];
const relatedSystems = [{ id: 2, name: "Email" }];

const queue = {
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  eligibleOwners: [{ id: 21, name: "IT Staff A", role: "IT_STAFF" as const }],
  items: [
    {
      id: 101,
      ticketNumber: "TT-20260918-RESP01",
      ticketDate: "2026-09-18T10:30:00.000Z",
      requester: { id: 11, name: "Requester A" },
      category: categories[0],
      relatedSystem: relatedSystems[0],
      requestedPriority: "HIGH" as const,
      itPriority: "MEDIUM" as const,
      summary: "Cannot access course email",
      currentStatus: "OPEN" as const,
      owner: { id: 21, name: "IT Staff A", role: "IT_STAFF" as const },
      lastUpdated: "2026-09-18T10:35:00.000Z",
    },
  ],
};

const users = [
  {
    id: administrator.id,
    name: administrator.name,
    email: administrator.email,
    role: administrator.role,
    status: "ACTIVE" as const,
  },
  {
    id: staffUser.id,
    name: staffUser.name,
    email: staffUser.email,
    role: staffUser.role,
    status: "ACTIVE" as const,
  },
];

function authResponse(user: typeof staffUser | typeof administrator) {
  return {
    user,
    session: { expiresAt: "2026-09-19T17:00:00.000Z" },
    csrfToken: "csrf-token",
  };
}

async function fulfillJson(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  payload: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function mockStaffApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(staffUser)),
  );
  await page.route("**/api/staff/tickets**", (route) =>
    fulfillJson(route, queue),
  );
  await page.route("**/api/categories", (route) =>
    fulfillJson(route, categories),
  );
  await page.route("**/api/related-systems", (route) =>
    fulfillJson(route, relatedSystems),
  );
}

async function mockAdministratorApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(administrator)),
  );
  await page.route("**/api/admin/users**", (route) =>
    fulfillJson(route, users),
  );
}

async function mockRequesterApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, {
      user: requester,
      session: { expiresAt: "2026-09-19T17:00:00.000Z" },
      csrfToken: "csrf-token",
    }),
  );
  await page.route("**/api/categories", (route) =>
    fulfillJson(route, categories),
  );
  await page.route("**/api/related-systems", (route) =>
    fulfillJson(route, relatedSystems),
  );
  await page.route("**/api/tickets**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/tickets/${requesterTicket.id}`) {
      return fulfillJson(route, requesterTicket);
    }
    return fulfillJson(route, {
      items: [requesterTicket],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ) <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test.describe("Lab 3 responsive and accessible presentation", () => {
  test("switches the Staff Queue between cards and table without overflow", async ({
    page,
  }) => {
    await mockStaffApi(page);
    await page.goto("/staff/tickets");
    await expect(
      page.getByRole("heading", { name: "Ticket Queue" }),
    ).toBeVisible();

    const table = page.locator(".lab3-staff-ticket-table-wrapper");
    const cards = page.locator(".lab3-staff-ticket-cards");

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 820, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(cards).toBeVisible();
      await expect(table).toBeHidden();
      await expect(cards.getByText("Created")).toBeVisible();
      await expect(cards.getByText("Category / Related System")).toBeVisible();
      await expect(
        cards.getByRole("button", { name: "Open detail" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(table).toBeVisible();
    await expect(cards).toBeHidden();
    await expect(
      table.getByRole("columnheader", { name: "Status" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("Search tickets").focus();
    await expect(page.getByLabel("Search tickets")).toBeFocused();
    await expect(page.getByLabel("Status")).toHaveAccessibleName("Status");
    await expect(page.getByLabel("Requested Priority")).toHaveAccessibleName(
      "Requested Priority",
    );
  });

  test("captures the Requester routes at every required viewport", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await mkdir(requesterEvidenceDirectory, { recursive: true });
    await mockRequesterApi(page);

    const screens = [
      ["/tickets", "My Tickets", "my-tickets"],
      ["/tickets/new", "Create Ticket", "create-ticket"],
      [
        `/tickets/${requesterTicket.id}`,
        requesterTicket.ticketNumber,
        "ticket-detail",
      ],
    ] as const;

    for (const [route, heading, filename] of screens) {
      for (const viewport of requiredViewports) {
        await page.setViewportSize(viewport);
        await page.goto(route);
        await expect(
          page.getByRole("heading", { name: heading }),
        ).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: resolve(
            requesterEvidenceDirectory,
            `${filename}-${viewport.label}.png`,
          ),
          fullPage: true,
        });
      }
    }
  });

  test("keeps Administrator User Management cards and named controls accessible on tablet", async ({
    page,
  }) => {
    await mockAdministratorApi(page);
    await page.setViewportSize({ width: 820, height: 900 });
    await page.goto("/admin/users");

    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();
    await expect(page.locator(".lab3-user-table-wrapper")).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Administrator User cards" }),
    ).toBeVisible();
    await expect(page.getByLabel("Search users")).toHaveAccessibleName(
      "Search users",
    );
    await expect(page.getByLabel("Role")).toHaveAccessibleName("Role");
    await expect(
      page.getByRole("button", { name: "Create user" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit" }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("Search users").focus();
    await expect(page.getByLabel("Search users")).toBeFocused();
  });
});
