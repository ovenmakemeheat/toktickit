import { expect, test, type Page } from "@playwright/test";

type Route = Parameters<Parameters<Page["route"]>[1]>[0];
type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type UserStatus = "ACTIVE" | "INACTIVE";
type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

const administrator = {
  id: 1,
  name: "Administrator",
  email: "administrator@toktickit.test",
  role: "ADMINISTRATOR" as const,
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

const initialUsers: AdminUser[] = [
  {
    id: administrator.id,
    name: administrator.name,
    email: administrator.email,
    role: administrator.role,
    status: "ACTIVE",
  },
  {
    id: 11,
    name: "Requester A",
    email: "requester-a@toktickit.test",
    role: "REQUESTER",
    status: "INACTIVE",
  },
  {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    status: "ACTIVE",
  },
];

const ticketDetail = {
  id: 101,
  ticketNumber: "TT-20260919-ADMIN01",
  ticketDate: "2026-09-19T10:30:00.000Z",
  requester: { id: 11, name: "Requester A" },
  category: { id: 1, name: "Software" },
  relatedSystem: { id: 2, name: "Email" },
  requestedPriority: "HIGH" as const,
  itPriority: "MEDIUM" as const,
  summary: "Cannot access course email",
  description: "The browser shows an authentication error after sign-in.",
  currentStatus: "OPEN" as const,
  owner: { id: 21, name: "IT Staff A", role: "IT_STAFF" as const },
  requesterResolutionIndicatedAt: "2026-09-19T11:30:00.000Z",
  createdAt: "2026-09-19T10:30:00.000Z",
  updatedAt: "2026-09-19T11:35:00.000Z",
  attachments: [
    {
      id: 301,
      displayName: "error.png",
      mimeType: "image/png",
      sizeBytes: 2_048,
      uploadedAt: "2026-09-19T10:40:00.000Z",
      removedAt: null,
      removalReason: null,
      isActive: true,
      downloadUrl: null,
    },
  ],
  publicComments: [
    {
      id: 401,
      author: { id: 21, name: "IT Staff A", role: "IT_STAFF" as const },
      content: "Please try the documented sign-in again.",
      createdAt: "2026-09-19T10:40:00.000Z",
    },
  ],
  internalNotes: [
    {
      id: 402,
      author: { id: 21, name: "IT Staff A", role: "IT_STAFF" as const },
      content: "Private triage detail.",
      createdAt: "2026-09-19T10:45:00.000Z",
    },
  ],
};

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

function authResponse(user: typeof administrator | typeof staff) {
  return {
    user,
    session: { expiresAt: "2026-09-20T17:00:00.000Z" },
    csrfToken: "csrf-token",
  };
}

async function mockAdministratorWorkflow(page: Page) {
  let users = initialUsers.map((user) => ({ ...user }));
  let nextUserId = 40;
  let currentTicket = { ...ticketDetail };

  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(administrator)),
  );
  await page.route("**/api/admin/users**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/admin/users" && request.method() === "GET") {
      await fulfillJson(route, users);
      return;
    }

    if (url.pathname === "/api/admin/users" && request.method() === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const created: AdminUser = {
        id: nextUserId++,
        name: body.name,
        email: body.email,
        role: body.role,
        status: body.active ? "ACTIVE" : "INACTIVE",
      };
      users = [...users, created];
      await fulfillJson(route, created, 201);
      return;
    }

    const userMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if (userMatch && request.method() === "PATCH") {
      const id = Number(userMatch[1]);
      const body = JSON.parse(request.postData() ?? "{}");
      const current = users.find((user) => user.id === id);
      if (!current) {
        await fulfillJson(
          route,
          { error: { code: "USER_NOT_FOUND", message: "User not found." } },
          404,
        );
        return;
      }
      const updated: AdminUser = {
        ...current,
        ...body,
        status:
          body.active === undefined
            ? current.status
            : body.active
              ? "ACTIVE"
              : "INACTIVE",
      };
      users = users.map((user) => (user.id === id ? updated : user));
      await fulfillJson(route, updated);
      return;
    }

    const passwordMatch = url.pathname.match(
      /^\/api\/admin\/users\/(\d+)\/initial-password$/,
    );
    if (passwordMatch && request.method() === "POST") {
      await route.fulfill({ status: 204 });
      return;
    }

    await fulfillJson(
      route,
      { error: { code: "NOT_FOUND", message: "Route not found." } },
      404,
    );
  });
  await page.route("**/api/admin/tickets/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.pathname === "/api/admin/tickets/101" &&
      request.method() === "GET"
    ) {
      await fulfillJson(route, currentTicket);
      return;
    }
    if (
      url.pathname === "/api/admin/tickets/101/priority" &&
      request.method() === "PATCH"
    ) {
      const body = JSON.parse(request.postData() ?? "{}");
      currentTicket = { ...currentTicket, itPriority: body.itPriority };
      await fulfillJson(route, currentTicket);
      return;
    }
    await fulfillJson(
      route,
      { error: { code: "NOT_FOUND", message: "Route not found." } },
      404,
    );
  });
}

async function mockStaffShell(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    fulfillJson(route, authResponse(staff)),
  );
  await page.route("**/api/admin/users**", (route) =>
    fulfillJson(
      route,
      { error: { code: "USER_MANAGEMENT_FORBIDDEN", message: "Forbidden." } },
      403,
    ),
  );
}

test.describe("Lab 3 Administrator management", () => {
  test("manages Users and performs read-only Ticket Review with IT Priority access", async ({
    page,
  }) => {
    await mockAdministratorWorkflow(page);
    await page.goto("/admin/users");

    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: /administrator@toktickit\.test/ }),
    ).toBeVisible();

    await page.getByLabel("Search users").fill("Requester");
    await page.getByLabel("Role").selectOption("REQUESTER");
    await expect(
      page.getByRole("button", { name: "Clear filters" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();

    await page.getByRole("button", { name: "Create user" }).first().click();
    const initialPassword = `${Date.now()}${String.fromCharCode(65, 49, 33)}`;
    const createForm = page.getByRole("form", { name: "Create user" });
    await createForm.getByLabel(/^Name/).fill("New Staff");
    await createForm
      .getByLabel(/^Email address/)
      .fill("new-staff@toktickit.test");
    await createForm.getByLabel(/^Role/).selectOption("IT_STAFF");
    await createForm.getByLabel(/^Initial password/).fill(initialPassword);
    await createForm
      .getByLabel(/^Confirm initial password/)
      .fill(initialPassword);
    await createForm.getByRole("button", { name: "Create user" }).click();
    await expect(
      page.getByText(
        "New Staff was created and must change the initial password at the next sign-in.",
      ),
    ).toBeVisible();

    const requesterRow = page.getByRole("row", {
      name: /requester-a@toktickit\.test/,
    });
    await requesterRow.getByRole("button", { name: "Edit" }).click();
    const editForm = page.getByRole("form", { name: "Edit Requester A" });
    await editForm.getByLabel(/^Name/).fill("Requester A Renamed");
    await editForm.getByRole("checkbox", { name: /Account is active/ }).check();
    await editForm.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Requester A Renamed was updated."),
    ).toBeVisible();

    const administratorRow = page.getByRole("row", {
      name: /administrator@toktickit\.test/,
    });
    await administratorRow.getByRole("button", { name: "Edit" }).click();
    await expect(
      page.getByText("You cannot deactivate your own Administrator account."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Set new initial password" })
      .click();
    const replacementPassword = `${Date.now()}${String.fromCharCode(66, 50, 64)}`;
    const resetForm = page.getByRole("form", {
      name: "Set new initial password",
    });
    await resetForm
      .getByLabel(/^New initial password/)
      .fill(replacementPassword);
    await resetForm
      .getByLabel(/^Confirm new initial password/)
      .fill(replacementPassword);
    await resetForm
      .getByRole("button", { name: "Save new initial password" })
      .click();
    await expect(
      page.getByText(/A new initial password was set for Administrator\./),
    ).toBeVisible();

    await page.getByRole("button", { name: "Ticket Review" }).click();
    await expect(
      page.getByRole("heading", { name: "Administrator Ticket Review" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open Ticket Review" }).click();
    await expect(page.getByText("Enter a positive Ticket ID.")).toBeVisible();
    await page.getByLabel(/^Ticket ID/).fill("101");
    await page.getByRole("button", { name: "Open Ticket Review" }).click();

    await expect(
      page.getByRole("heading", { name: "TT-20260919-ADMIN01" }),
    ).toBeVisible();
    await expect(page.getByText("Private triage detail.")).toBeVisible();
    await expect(page.getByText("error.png")).toBeVisible();
    await expect(page.getByRole("button", { name: "Claim" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Update status" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Post public comment" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add internal note" }),
    ).toHaveCount(0);

    await page.getByLabel("IT Priority").selectOption("LOW");
    await page.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(
      page.getByText("IT Priority updated successfully."),
    ).toBeVisible();
  });

  test("does not expose Administrator screens to IT Staff", async ({
    page,
  }) => {
    await mockStaffShell(page);
    await page.goto("/admin/users");

    await expect(
      page.getByRole("heading", { name: "IT Staff access is ready" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "User Management" }),
    ).toHaveCount(0);
  });
});
