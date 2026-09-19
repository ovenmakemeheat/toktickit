import { expect, test, type Page } from "@playwright/test";

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

type AuthResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    role: Role;
    active: boolean;
    mustChangePassword: boolean;
  };
  csrfToken: string;
};

const seededPassword = process.env.LAB3_SEED_PASSWORD;

function requireSeededPassword() {
  if (!seededPassword) {
    throw new Error(
      "LAB3_SEED_PASSWORD must be loaded from server/.env for the seeded release regression.",
    );
  }
  return seededPassword;
}

function e2ePassword(seedPassword: string) {
  return `${seedPassword.slice(0, 100)}Lab3E2E!9`;
}

async function loginSeededUser(page: Page, email: string, role: Role) {
  const initialPassword = requireSeededPassword();
  const replacementPassword = e2ePassword(initialPassword);

  for (const password of [initialPassword, replacementPassword]) {
    const login = await page.request.post("/api/auth/login", {
      data: { email, password },
    });
    if (!login.ok()) {
      continue;
    }

    const session = (await login.json()) as AuthResponse;
    if (session.user.mustChangePassword) {
      const changed = await page.request.patch("/api/auth/password", {
        data: {
          currentPassword: password,
          newPassword: replacementPassword,
          confirmPassword: replacementPassword,
        },
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      expect(changed.ok()).toBe(true);
    }

    const currentUserResponse = await page.request.get("/api/auth/me");
    expect(currentUserResponse.ok()).toBe(true);
    const currentUser = (await currentUserResponse.json()) as AuthResponse;
    expect(currentUser.user).toMatchObject({ email, role, active: true });
    expect(currentUser.user.mustChangePassword).toBe(false);
    return currentUser;
  }

  throw new Error(
    `Unable to authenticate seeded User ${email}; reset the local seed or provide its configured password.`,
  );
}

async function expectForbidden(
  response: Awaited<ReturnType<Page["request"]["get"]>>,
  code: string,
) {
  expect(response.status()).toBe(403);
  const body = (await response.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBe(code);
}

test.describe("Lab 3 integrated release regression", () => {
  test("runs the seeded API through the role route smoke matrix", async ({
    page,
    context,
  }) => {
    const health = await page.request.get("/api/health");
    expect(health.ok()).toBe(true);

    await loginSeededUser(page, "requester-a@toktickit.test", "REQUESTER");
    await page.goto("/tickets");
    await expect(
      page.getByRole("heading", { name: "My Tickets" }),
    ).toBeVisible();
    await expect(page.getByText("TT-20260910-SEED01").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ticket Queue" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "User Management" }),
    ).toHaveCount(0);

    await context.clearCookies();
    await loginSeededUser(page, "it-staff-a@toktickit.test", "IT_STAFF");
    await page.goto("/staff/tickets");
    await expect(
      page.getByRole("heading", { name: "Ticket Queue" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "TT-20260910-SEED01" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "User Management" }),
    ).toHaveCount(0);

    await context.clearCookies();
    await loginSeededUser(
      page,
      "administrator@toktickit.test",
      "ADMINISTRATOR",
    );
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "administrator@toktickit.test" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ticket Queue" }),
    ).toHaveCount(0);
  });

  test("enforces role-forbidden API and destination boundaries with a seeded session", async ({
    page,
  }) => {
    await loginSeededUser(page, "requester-a@toktickit.test", "REQUESTER");

    await expectForbidden(
      await page.request.get("/api/staff/tickets"),
      "STAFF_QUEUE_FORBIDDEN",
    );
    await expectForbidden(
      await page.request.get("/api/admin/users"),
      "USER_MANAGEMENT_FORBIDDEN",
    );

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
