import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { prisma } from "../../server/src/db.js";

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

type DashboardResponse = {
  asOf: string;
  metrics: Record<string, unknown>;
  recentlyUpdated: { id: number; ticketNumber: string }[];
  myRecentActions?: { id: number; ticketId: number; ticketNumber: string }[];
};

const seededPassword = process.env.LAB3_SEED_PASSWORD;

function requireSeededPassword() {
  if (!seededPassword) {
    throw new Error(
      "LAB3_SEED_PASSWORD must be loaded from server/.env for the seeded dashboard E2E.",
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

    const currentResponse = await page.request.get("/api/auth/me");
    expect(currentResponse.ok()).toBe(true);
    const current = (await currentResponse.json()) as AuthResponse;
    expect(current.user).toMatchObject({ email, role, active: true });
    expect(current.user.mustChangePassword).toBe(false);
    return current;
  }

  throw new Error(`Unable to authenticate seeded User ${email}.`);
}

async function createDashboardFixtures() {
  const [requester, staffA, staffB, category, relatedSystem] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { email: "requester-a@toktickit.test" },
        select: { id: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "it-staff-a@toktickit.test" },
        select: { id: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "it-staff-b@toktickit.test" },
        select: { id: true },
      }),
      prisma.category.findUniqueOrThrow({
        where: { name: "Software" },
        select: { id: true },
      }),
      prisma.relatedSystem.findUniqueOrThrow({
        where: { name: "Email" },
        select: { id: true },
      }),
    ]);
  const now = new Date();
  const marker = randomUUID().slice(0, 8).toUpperCase();
  const tickets = await Promise.all(
    [
      { suffix: "OPEN", status: "OPEN" as const, resolvedAt: null },
      {
        suffix: "WAIT",
        status: "WAITING_FOR_REQUESTER" as const,
        resolvedAt: null,
      },
      {
        suffix: "DONE",
        status: "RESOLVED" as const,
        resolvedAt: now,
      },
    ].map((item) =>
      prisma.ticket.create({
        data: {
          ticketNumber: `TT-L4DASH-${marker}-${item.suffix}`,
          clientRequestId: randomUUID(),
          ticketDate: now,
          requesterUserId: requester.id,
          primaryOwnerUserId: staffB.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          currentStatus: item.status,
          summary: `Lab 4 dashboard ${marker} ${item.suffix}`,
          description: "Temporary dashboard E2E fixture.",
          resolvedAt: item.resolvedAt,
          updatedAt: now,
        },
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          currentStatus: true,
        },
      }),
    ),
  );
  return {
    requesterId: requester.id,
    staffAId: staffA.id,
    staffBId: staffB.id,
    tickets,
  };
}

test.describe("Lab 4 role dashboards", () => {
  test("shows session-scoped Requester and performer-scoped Staff/Admin dashboards", async ({
    page,
    context,
  }) => {
    const fixture = await createDashboardFixtures();
    try {
      await loginSeededUser(page, "requester-a@toktickit.test", "REQUESTER");
      const requesterBaselineResponse = await page.request.get(
        "/api/requester/dashboard",
      );
      expect(requesterBaselineResponse.ok()).toBe(true);
      const requesterBaseline = (await requesterBaselineResponse.json()) as {
        metrics: {
          openCount: number;
          waitingForRequesterCount: number;
          recentlyResolvedCount: number;
        };
      };

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Requester Dashboard" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `Open Tickets: ${requesterBaseline.metrics.openCount}. View active Tickets.`,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `Waiting for You: ${requesterBaseline.metrics.waitingForRequesterCount}. View Tickets waiting for your response.`,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(fixture.tickets[0].ticketNumber),
      ).toBeVisible();
      await expect(
        page.getByText(fixture.tickets[1].ticketNumber),
      ).toBeVisible();
      await expect(
        page.getByText(fixture.tickets[2].ticketNumber).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Ticket Queue" }),
      ).toHaveCount(0);

      await page
        .getByRole("button", {
          name: `Waiting for You: ${requesterBaseline.metrics.waitingForRequesterCount}. View Tickets waiting for your response.`,
        })
        .click();
      await expect(page).toHaveURL(
        /\/tickets\?currentStatus=WAITING_FOR_REQUESTER$/,
      );
      await expect(page.getByLabel("Current Status")).toHaveValue(
        "WAITING_FOR_REQUESTER",
      );

      await context.clearCookies();
      const staffSession = await loginSeededUser(
        page,
        "it-staff-a@toktickit.test",
        "IT_STAFF",
      );
      const staffResponse = await page.request.get("/api/staff/dashboard");
      expect(staffResponse.ok()).toBe(true);
      const staffDashboard = (await staffResponse.json()) as DashboardResponse;
      const resolvedTicket = fixture.tickets[2];
      const actionResponse = await page.request.post(
        `/api/tickets/${resolvedTicket.id}/actions-taken`,
        {
          headers: {
            "X-CSRF-Token": staffSession.csrfToken,
            "Idempotency-Key": randomUUID(),
          },
          data: {
            actionAt: new Date().toISOString(),
            actionDescription: `Dashboard E2E action ${fixture.tickets[0].ticketNumber}`,
            result: "The resolved Ticket retains its action history.",
            followUpRequired: false,
            followUpNote: null,
            attachmentNotes: "Temporary dashboard E2E note.",
          },
        },
      );
      expect(actionResponse.status()).toBe(201);
      const action = (await actionResponse.json()) as { id: number };
      const ticketOwner = await prisma.ticket.findUniqueOrThrow({
        where: { id: resolvedTicket.id },
        select: { primaryOwnerUserId: true },
      });
      expect(ticketOwner.primaryOwnerUserId).toBe(fixture.staffBId);
      expect(fixture.staffAId).not.toBe(fixture.staffBId);

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Staff Dashboard" }),
      ).toBeVisible();
      const actionRow = page.getByRole("button", {
        name: new RegExp(
          `Open Action Taken on Ticket ${resolvedTicket.ticketNumber}`,
        ),
      });
      await expect(actionRow).toBeVisible();
      await expect(actionRow).toContainText(
        `Dashboard E2E action ${fixture.tickets[0].ticketNumber}`,
      );
      expect(staffDashboard.metrics).toBeDefined();
      await actionRow.click();
      await expect(page).toHaveURL(
        new RegExp(
          `/staff/tickets/${resolvedTicket.id}#action-taken-${action.id}$`,
        ),
      );
      await expect(page.locator(`#action-taken-${action.id}`)).toBeFocused();
      await expect(page.getByText("Performed by IT Staff A")).toBeVisible();

      await context.clearCookies();
      await loginSeededUser(
        page,
        "administrator@toktickit.test",
        "ADMINISTRATOR",
      );
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Staff Dashboard" }),
      ).toBeVisible();
      const navigation = page.getByRole("navigation", {
        name: "Application navigation",
      });
      await expect(
        navigation.getByRole("button", { name: "User Management" }),
      ).toBeVisible();
      await expect(
        navigation.getByRole("button", { name: "Ticket Review" }),
      ).toBeVisible();
      const adminResponse = await page.request.get("/api/staff/dashboard");
      expect(adminResponse.ok()).toBe(true);
      const adminDashboard = (await adminResponse.json()) as DashboardResponse;
      expect(adminDashboard.metrics.unassignedActiveCount).toBe(
        staffDashboard.metrics.unassignedActiveCount,
      );
      expect(adminDashboard.metrics.highPriorityActiveCount).toBe(
        staffDashboard.metrics.highPriorityActiveCount,
      );
      expect(adminDashboard.metrics.statusBreakdown).toEqual(
        staffDashboard.metrics.statusBreakdown,
      );
      expect(adminDashboard.metrics.itPriorityBreakdown).toEqual(
        staffDashboard.metrics.itPriorityBreakdown,
      );
    } finally {
      await prisma.ticket.deleteMany({
        where: { id: { in: fixture.tickets.map((ticket) => ticket.id) } },
      });
      await context.clearCookies();
    }
  });
});
