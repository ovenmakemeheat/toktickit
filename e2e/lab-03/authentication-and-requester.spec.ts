import { expect, test, type Page } from "@playwright/test";

const requester = {
  id: 11,
  name: "Requester A",
  email: "requester-a@toktickit.test",
  role: "REQUESTER" as const,
  active: true,
  mustChangePassword: false,
};

const initialPasswordUser = {
  ...requester,
  mustChangePassword: true,
};

const authResponse = (user: typeof requester) => ({
  user,
  session: { expiresAt: "2026-09-14T17:00:00.000Z" },
  csrfToken: "csrf-token",
});

const categories = [
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
];

const relatedSystems = [
  { id: 4, name: "VPN" },
  { id: 5, name: "Email" },
];

const ticket = {
  id: 101,
  ticketNumber: "TT-20260913-E2E001",
  ticketDate: "2026-09-13T09:00:00.000Z",
  requester: { id: requester.id, name: requester.name },
  category: categories[0],
  relatedSystem: relatedSystems[0],
  requestedPriority: "HIGH" as const,
  summary: "VPN connection fails",
  description: "The VPN connection fails after entering the credentials.",
  currentStatus: "NEW" as const,
  createdAt: "2026-09-13T09:00:00.000Z",
  lastUpdated: "2026-09-13T09:00:00.000Z",
  attachments: [],
};

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

async function mockUnauthenticatedAuth(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(
      route,
      { error: { code: "SESSION_REQUIRED", message: "Sign in is required." } },
      401,
    ),
  );
  await page.route("**/api/auth/login", (route) =>
    fulfillJson(route, authResponse(requester)),
  );
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ status: 204 }),
  );
}

async function mockAuthenticatedRequester(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(requester)),
  );
  await page.route("**/api/categories", (route) =>
    fulfillJson(route, categories),
  );
  await page.route("**/api/related-systems", (route) =>
    fulfillJson(route, relatedSystems),
  );
  await page.route("**/api/tickets**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/tickets") {
      return fulfillJson(route, ticket, 201);
    }
    if (url.pathname === `/api/tickets/${ticket.id}`) {
      return fulfillJson(route, ticket);
    }
    return fulfillJson(route, {
      items: [ticket],
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

test.describe("Lab 3 authentication and Requester regression", () => {
  test("protects direct navigation, supports login, and invalidates logout", async ({
    page,
  }) => {
    await mockUnauthenticatedAuth(page);

    await page.goto("/tickets");
    await expect(
      page.getByRole("heading", { name: "Sign in to your service desk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Development Requester" }),
    ).toHaveCount(0);

    await page.getByLabel(/Email/).fill(requester.email);
    await page.getByLabel(/Password/).fill("CorrectPassword1!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeVisible();
    const navigation = page.getByRole("navigation", {
      name: "Application navigation",
    });
    await expect(
      navigation.getByRole("button", { name: "My Tickets" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change Requester" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(
      page.getByRole("heading", { name: "Sign in to your service desk" }),
    ).toBeVisible();
  });

  test("requires an initial password change before showing normal navigation", async ({
    page,
  }) => {
    await page.route("**/api/auth/me", (route) =>
      fulfillJson(route, authResponse(initialPasswordUser)),
    );
    await page.route("**/api/auth/password", (route) =>
      fulfillJson(route, authResponse(requester)),
    );
    await page.route("**/api/auth/logout", (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Change your initial password" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "My Tickets" })).toHaveCount(
      0,
    );

    await page.getByLabel(/Current password/).fill("InitialPassword1!");
    await page.getByLabel(/New password/).fill("ChangedPassword1!");
    await page.getByLabel(/Confirm new password/).fill("ChangedPassword1!");
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(
      page.getByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeVisible();
  });

  test("keeps the Lab 2 Requester flow under the authenticated identity", async ({
    page,
  }) => {
    await mockAuthenticatedRequester(page);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Welcome, Requester A" }),
    ).toBeVisible();
    await expect(page.getByText("Signed-in Requester")).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Development Requester" }),
    ).toHaveCount(0);

    const navigation = page.getByRole("navigation", {
      name: "Application navigation",
    });
    await navigation.getByRole("button", { name: "Create Ticket" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Ticket" }),
    ).toBeVisible();
    await page.getByRole("combobox", { name: "Category" }).selectOption("2");
    await page
      .getByRole("combobox", { name: "Related System" })
      .selectOption("4");
    await page
      .getByRole("combobox", { name: "Requested Priority" })
      .selectOption("HIGH");
    await page.getByRole("textbox", { name: "Summary" }).fill(ticket.summary);
    await page
      .getByRole("textbox", { name: "Description" })
      .fill(ticket.description);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: ticket.ticketNumber }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Application navigation" })
      .getByRole("button", { name: "My Tickets" })
      .click();
    await expect(
      page.getByRole("heading", { name: "My Tickets" }),
    ).toBeVisible();
    await expect(
      page.getByText(`Tickets owned by ${requester.name}`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open Ticket" }).click();
    await expect(
      page.getByRole("heading", { name: ticket.ticketNumber }),
    ).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 820, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expectNoHorizontalOverflow(page);
      await expect(
        page.getByRole("heading", { name: ticket.ticketNumber }),
      ).toBeVisible();
    }
  });
});
