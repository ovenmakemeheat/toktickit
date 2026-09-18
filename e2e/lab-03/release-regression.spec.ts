import { expect, test, type Page } from "@playwright/test";

type Route = Parameters<Parameters<Page["route"]>[1]>[0];

const requester = {
  id: 11,
  name: "Requester A",
  email: "requester-a@toktickit.test",
  role: "REQUESTER" as const,
  active: true,
  mustChangePassword: false,
};
const staff = {
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
const requesterTicket = {
  id: 101,
  ticketNumber: "TT-20260919-RELEASE01",
  ticketDate: "2026-09-19T10:30:00.000Z",
  requester: { id: requester.id, name: requester.name },
  category: categories[0],
  relatedSystem: relatedSystems[0],
  requestedPriority: "HIGH" as const,
  summary: "Release smoke ticket",
  description: "A stable fixture for the integrated Lab 3 route check.",
  currentStatus: "OPEN" as const,
  createdAt: "2026-09-19T10:30:00.000Z",
  lastUpdated: "2026-09-19T10:35:00.000Z",
  attachments: [],
};

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

function authResponse(
  user: typeof requester | typeof staff | typeof administrator,
) {
  return {
    user,
    session: { expiresAt: "2026-09-20T17:00:00.000Z" },
    csrfToken: "csrf-token",
  };
}

async function mockRequester(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(requester)),
  );
  await page.route("**/api/categories", (route) =>
    fulfillJson(route, categories),
  );
  await page.route("**/api/related-systems", (route) =>
    fulfillJson(route, relatedSystems),
  );
  await page.route("**/api/tickets**", (route) =>
    fulfillJson(route, {
      items: [requesterTicket],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    }),
  );
}

async function mockStaff(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(staff)),
  );
  await page.route("**/api/staff/tickets**", (route) =>
    fulfillJson(route, {
      items: [],
      eligibleOwners: [{ id: staff.id, name: staff.name, role: "IT_STAFF" }],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    }),
  );
  await page.route("**/api/categories", (route) =>
    fulfillJson(route, categories),
  );
  await page.route("**/api/related-systems", (route) =>
    fulfillJson(route, relatedSystems),
  );
}

async function mockAdministrator(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(administrator)),
  );
  await page.route("**/api/admin/users**", (route) =>
    fulfillJson(route, [
      {
        id: administrator.id,
        name: administrator.name,
        email: administrator.email,
        role: administrator.role,
        status: "ACTIVE",
      },
    ]),
  );
}

test.describe("Lab 3 integrated release regression", () => {
  test("keeps the API health check and role route smoke matrix green", async ({
    page,
  }) => {
    const health = await page.request.get("/api/health");
    expect(health.ok()).toBe(true);

    await mockRequester(page);
    await page.goto("/tickets");
    await expect(
      page.getByRole("heading", { name: "My Tickets" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ticket Queue" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "User Management" }),
    ).toHaveCount(0);

    await mockStaff(page);
    await page.goto("/staff/tickets");
    await expect(
      page.getByRole("heading", { name: "Ticket Queue" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "User Management" }),
    ).toHaveCount(0);

    await mockAdministrator(page);
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ticket Queue" }),
    ).toHaveCount(0);
  });

  test("keeps direct role-forbidden destinations inside the authenticated shell", async ({
    page,
  }) => {
    await mockRequester(page);
    await page.goto("/staff/tickets");
    await expect(
      page.getByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ticket Queue" }),
    ).toHaveCount(0);

    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toHaveCount(0);
  });
});
