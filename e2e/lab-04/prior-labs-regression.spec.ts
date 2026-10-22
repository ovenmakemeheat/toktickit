import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { loginSeededUser, prisma, type SeededRole } from "./seeded-helpers.js";

type RouteEvidence = {
  role: SeededRole;
  route: string;
  heading: string;
  internalLinksResolved: number;
  visibleControlsNamed: number;
  noPlaceholderText: boolean;
};
type ApiEvidence = {
  role: SeededRole;
  method: string;
  path: string;
  status: number;
};
type NavigationEvidence = {
  role: SeededRole;
  control: string;
  path: string;
};

const repositoryRoot = resolve(__dirname, "..", "..");
const reportDirectory = resolve(
  repositoryRoot,
  "artifacts/lab-04/e2e/e2e-04-hardening",
);
const reportPath = resolve(reportDirectory, "run-report.json");
const reportStartedAt = new Date();
const routeEvidence: RouteEvidence[] = [];
const apiEvidence: ApiEvidence[] = [];
const navigationEvidence: NavigationEvidence[] = [];
const browserConsoleErrors: string[] = [];
const pageErrors: string[] = [];

function gitRevision() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return process.env.GITHUB_SHA ?? "unknown";
  }
}

function isWorktreeDirty() {
  try {
    return Boolean(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }).trim(),
    );
  } catch {
    return null;
  }
}

async function recordApi(
  role: SeededRole,
  method: string,
  path: string,
  response: { status(): number },
) {
  apiEvidence.push({ role, method, path, status: response.status() });
}

async function navigateWithButton(
  page: Page,
  role: SeededRole,
  control: string,
  path: string,
  heading: string,
) {
  const navigation = page.getByRole("navigation", {
    name: "Application navigation",
  });
  const button = navigation.getByRole("button", { name: control, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page).toHaveURL((url) => url.pathname === path);
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
  navigationEvidence.push({ role, control, path });
}

async function auditCurrentPage(page: Page, role: SeededRole, route: string) {
  const heading = (await page.locator("h1").first().innerText()).trim();
  const pageText = await page.locator("body").innerText();
  const noPlaceholderText =
    !/\b(TODO|Coming Soon|Not Implemented|Lorem ipsum)\b/i.test(pageText);
  expect(noPlaceholderText, `${role} ${route} contains placeholder text`).toBe(
    true,
  );

  const controls = await page
    .locator("button, a, input, select, textarea")
    .evaluateAll((elements) => {
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      };
      const name = (element: Element) => {
        const labels =
          "labels" in element && element.labels
            ? Array.from(element.labels, (label) => label.innerText)
            : [];
        const labelledBy = element
          .getAttribute("aria-labelledby")
          ?.split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText ?? "")
          .join(" ");
        return [
          element.getAttribute("aria-label"),
          labelledBy,
          element.getAttribute("title"),
          ...labels,
          element.textContent,
          "value" in element ? String(element.value ?? "") : "",
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
      };
      const anchors = elements.filter(
        (element) => element.tagName === "A" && visible(element),
      );
      const unnamed = elements
        .filter(visible)
        .filter((element) => {
          if (
            element instanceof HTMLInputElement &&
            ["hidden", "submit", "button", "reset"].includes(element.type)
          ) {
            return element.type !== "hidden" && !name(element);
          }
          return !name(element);
        })
        .map((element) => element.outerHTML.slice(0, 240));
      const invalidAnchors = anchors
        .filter((anchor) => {
          const href = anchor.getAttribute("href")?.trim() ?? "";
          return !href || href === "#" || /^javascript:/i.test(href);
        })
        .map((anchor) => anchor.outerHTML.slice(0, 240));
      const internalHrefs = anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href)
        .filter(
          (href) =>
            new URL(href, window.location.href).origin ===
            window.location.origin,
        );
      return {
        unnamed,
        invalidAnchors,
        internalHrefs,
        visibleCount: elements.filter(visible).length,
      };
    });

  expect(
    controls.unnamed,
    `${role} ${route} has visible controls without an accessible name`,
  ).toEqual([]);
  expect(
    controls.invalidAnchors,
    `${role} ${route} has an empty or inert visible link`,
  ).toEqual([]);

  for (const href of controls.internalHrefs) {
    const response = await page.request.get(href);
    expect(response.status(), `${role} ${route} link ${href}`).toBeLessThan(
      400,
    );
  }

  routeEvidence.push({
    role,
    route,
    heading,
    internalLinksResolved: controls.internalHrefs.length,
    visibleControlsNamed: controls.visibleCount,
    noPlaceholderText,
  });
}

async function expectApiStatus(
  role: SeededRole,
  method: "get" | "post" | "patch",
  path: string,
  response: { status(): number },
  expectedStatus: number,
) {
  await recordApi(role, method.toUpperCase(), path, response);
  expect(response.status(), `${role} ${method.toUpperCase()} ${path}`).toBe(
    expectedStatus,
  );
}

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserConsoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async ({ page }, testInfo: TestInfo) => {
  await mkdir(reportDirectory, { recursive: true });
  const report = {
    testId: "E2E-04",
    revision: gitRevision(),
    worktreeDirty: isWorktreeDirty(),
    startedAt: reportStartedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    status: testInfo.status,
    expectedStatus: testInfo.expectedStatus,
    browser: testInfo.project.name,
    finalPath: new URL(page.url()).pathname,
    routes: routeEvidence,
    navigation: navigationEvidence,
    api: apiEvidence,
    browserConsoleErrors,
    pageErrors,
    businessApiMocks: false,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
});

test.describe("Lab 4 integrated role and prior-Lab release regression", () => {
  test("enforces the seeded role matrix and audits representative routes", async ({
    page,
    context,
  }) => {
    const requesterATicket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TT-20260910-SEED01" },
      select: {
        id: true,
        ticketNumber: true,
        currentStatus: true,
        itPriority: true,
        updatedAt: true,
        primaryOwnerUserId: true,
      },
    });
    const requesterBTicket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TT-20260910-SEED02" },
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        currentStatus: true,
        itPriority: true,
        updatedAt: true,
        primaryOwnerUserId: true,
      },
    });
    const actionTicket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TT-20260910-SEED05" },
      select: { id: true },
    });
    const existingAction = await prisma.actionTaken.findFirstOrThrow({
      where: { ticketId: actionTicket.id },
      orderBy: { id: "asc" },
      select: { id: true, version: true, result: true },
    });
    const originalPriority = requesterBTicket.itPriority;
    const noActionsBefore = await prisma.actionTaken.count({
      where: { ticketId: requesterATicket.id },
    });

    try {
      const requester = await loginSeededUser(
        page,
        "requester-a@toktickit.test",
        "REQUESTER",
      );
      const ownedTicketResponse = await page.request.get(
        `/api/tickets/${requesterATicket.id}`,
      );
      await expectApiStatus(
        "REQUESTER",
        "get",
        `/api/tickets/${requesterATicket.id}`,
        ownedTicketResponse,
        200,
      );
      const ownActions = await page.request.get(
        `/api/tickets/${requesterATicket.id}/actions-taken`,
      );
      await expectApiStatus(
        "REQUESTER",
        "get",
        `/api/tickets/${requesterATicket.id}/actions-taken`,
        ownActions,
        200,
      );
      expect(await ownActions.json()).toEqual({ items: [] });

      const crossTicket = await page.request.get(
        `/api/tickets/${requesterBTicket.id}`,
      );
      await expectApiStatus(
        "REQUESTER",
        "get",
        `/api/tickets/${requesterBTicket.id}`,
        crossTicket,
        404,
      );
      expect(await crossTicket.json()).toMatchObject({
        error: { code: "TICKET_NOT_FOUND" },
      });
      const crossActions = await page.request.get(
        `/api/tickets/${requesterBTicket.id}/actions-taken`,
      );
      await expectApiStatus(
        "REQUESTER",
        "get",
        `/api/tickets/${requesterBTicket.id}/actions-taken`,
        crossActions,
        404,
      );
      expect(JSON.stringify(await crossActions.json())).not.toContain(
        requesterBTicket.summary,
      );

      const rejectedCreate = await page.request.post(
        `/api/tickets/${requesterATicket.id}/actions-taken`,
        {
          headers: {
            "X-CSRF-Token": requester.csrfToken,
            "Idempotency-Key": randomUUID(),
          },
          data: {
            actionAt: new Date().toISOString(),
            actionDescription: "Requester must not write work history.",
            result: "This request must be rejected.",
            followUpRequired: false,
            followUpNote: null,
            attachmentNotes: null,
          },
        },
      );
      await expectApiStatus(
        "REQUESTER",
        "post",
        `/api/tickets/${requesterATicket.id}/actions-taken`,
        rejectedCreate,
        403,
      );
      expect(await rejectedCreate.json()).toMatchObject({
        error: { code: "ACTION_TAKEN_FORBIDDEN" },
      });

      const rejectedEdit = await page.request.patch(
        `/api/tickets/${actionTicket.id}/actions-taken/${existingAction.id}`,
        {
          headers: { "X-CSRF-Token": requester.csrfToken },
          data: {
            expectedVersion: existingAction.version,
            result: "Requester must not edit work history.",
          },
        },
      );
      await expectApiStatus(
        "REQUESTER",
        "patch",
        `/api/tickets/${actionTicket.id}/actions-taken/${existingAction.id}`,
        rejectedEdit,
        403,
      );
      expect(await rejectedEdit.json()).toMatchObject({
        error: { code: "ACTION_TAKEN_FORBIDDEN" },
      });

      for (const status of ["RESOLVED", "CLOSED"] as const) {
        const rejectedStatus = await page.request.patch(
          `/api/staff/tickets/${requesterATicket.id}/status`,
          {
            headers: { "X-CSRF-Token": requester.csrfToken },
            data: {
              expectedStatus: requesterATicket.currentStatus,
              status,
              confirmation: true,
            },
          },
        );
        await expectApiStatus(
          "REQUESTER",
          "patch",
          `/api/staff/tickets/${requesterATicket.id}/status`,
          rejectedStatus,
          403,
        );
        expect(await rejectedStatus.json()).toMatchObject({
          error: { code: "STAFF_TICKET_FORBIDDEN" },
        });
      }

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Requester Dashboard" }),
      ).toBeVisible();
      await auditCurrentPage(page, "REQUESTER", "/dashboard");
      await navigateWithButton(
        page,
        "REQUESTER",
        "My Tickets",
        "/tickets",
        "My Tickets",
      );
      await expect(
        page.getByRole("cell", { name: requesterATicket.ticketNumber }),
      ).toBeVisible();
      await auditCurrentPage(page, "REQUESTER", "/tickets");
      await page.goto(`/tickets/${requesterATicket.id}`);
      await expect(
        page.getByRole("heading", { name: requesterATicket.ticketNumber }),
      ).toBeVisible();
      await auditCurrentPage(
        page,
        "REQUESTER",
        `/tickets/${requesterATicket.id}`,
      );
      await navigateWithButton(
        page,
        "REQUESTER",
        "Create Ticket",
        "/tickets/new",
        "Create Ticket",
      );
      await auditCurrentPage(page, "REQUESTER", "/tickets/new");
      await page.goto("/staff/tickets");
      await expect(
        page.getByRole("heading", { name: "Welcome, Requester A" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Ticket Queue" }),
      ).toHaveCount(0);
      await auditCurrentPage(page, "REQUESTER", "/staff/tickets");
      await page.goto("/admin/users");
      await expect(
        page.getByRole("heading", { name: "Welcome, Requester A" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "User Management" }),
      ).toHaveCount(0);
      await auditCurrentPage(page, "REQUESTER", "/admin/users");

      expect(
        await prisma.actionTaken.count({
          where: { ticketId: requesterATicket.id },
        }),
      ).toBe(noActionsBefore);
      expect(
        await prisma.actionTaken.findUniqueOrThrow({
          where: { id: existingAction.id },
          select: { result: true, version: true },
        }),
      ).toEqual({
        result: existingAction.result,
        version: existingAction.version,
      });
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: requesterATicket.id },
          select: {
            currentStatus: true,
            resolvedAt: true,
            updatedAt: true,
            primaryOwnerUserId: true,
          },
        }),
      ).toEqual({
        currentStatus: requesterATicket.currentStatus,
        resolvedAt: null,
        updatedAt: requesterATicket.updatedAt,
        primaryOwnerUserId: requesterATicket.primaryOwnerUserId,
      });

      await context.clearCookies();
      await loginSeededUser(page, "it-staff-a@toktickit.test", "IT_STAFF");
      const staffQueue = await page.request.get("/api/staff/tickets");
      await expectApiStatus(
        "IT_STAFF",
        "get",
        "/api/staff/tickets",
        staffQueue,
        200,
      );
      const staffDetail = await page.request.get(
        `/api/staff/tickets/${requesterBTicket.id}`,
      );
      await expectApiStatus(
        "IT_STAFF",
        "get",
        `/api/staff/tickets/${requesterBTicket.id}`,
        staffDetail,
        200,
      );
      const staffDashboard = await page.request.get("/api/staff/dashboard");
      await expectApiStatus(
        "IT_STAFF",
        "get",
        "/api/staff/dashboard",
        staffDashboard,
        200,
      );
      const staffAdminUsers = await page.request.get("/api/admin/users");
      await expectApiStatus(
        "IT_STAFF",
        "get",
        "/api/admin/users",
        staffAdminUsers,
        403,
      );
      expect(await staffAdminUsers.json()).toMatchObject({
        error: { code: "USER_MANAGEMENT_FORBIDDEN" },
      });
      const staffAdminTicket = await page.request.get(
        `/api/admin/tickets/${requesterBTicket.id}`,
      );
      await expectApiStatus(
        "IT_STAFF",
        "get",
        `/api/admin/tickets/${requesterBTicket.id}`,
        staffAdminTicket,
        403,
      );

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Staff Dashboard" }),
      ).toBeVisible();
      await auditCurrentPage(page, "IT_STAFF", "/dashboard");
      await navigateWithButton(
        page,
        "IT_STAFF",
        "Ticket Queue",
        "/staff/tickets",
        "Ticket Queue",
      );
      await expect(
        page.getByRole("heading", { name: requesterBTicket.ticketNumber }),
      ).toBeVisible();
      await auditCurrentPage(page, "IT_STAFF", "/staff/tickets");
      await page.goto(`/staff/tickets/${requesterBTicket.id}`);
      await expect(
        page.getByRole("heading", { name: requesterBTicket.ticketNumber }),
      ).toBeVisible();
      await expect(
        page.getByText("Please try the documented browser sign-in again."),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Seed note: verify the identity provider response before escalation.",
        ),
      ).toBeVisible();
      await auditCurrentPage(
        page,
        "IT_STAFF",
        `/staff/tickets/${requesterBTicket.id}`,
      );
      await page.goto("/admin/users");
      await expect(
        page.getByRole("heading", { name: "IT Staff access is ready" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "User Management" }),
      ).toHaveCount(0);
      await auditCurrentPage(page, "IT_STAFF", "/admin/users");

      await context.clearCookies();
      await loginSeededUser(page, "requester-b@toktickit.test", "REQUESTER");
      const requesterComment = await page.request.get(
        `/api/tickets/${requesterBTicket.id}/comments`,
      );
      await expectApiStatus(
        "REQUESTER",
        "get",
        `/api/tickets/${requesterBTicket.id}/comments`,
        requesterComment,
        200,
      );
      await page.goto(`/tickets/${requesterBTicket.id}`);
      await expect(
        page.getByRole("heading", { name: requesterBTicket.ticketNumber }),
      ).toBeVisible();
      await expect(
        page.getByText("Please try the documented browser sign-in again."),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Seed note: verify the identity provider response before escalation.",
        ),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Internal Notes" }),
      ).toHaveCount(0);
      await auditCurrentPage(
        page,
        "REQUESTER",
        `/tickets/${requesterBTicket.id}`,
      );

      await context.clearCookies();
      await loginSeededUser(
        page,
        "administrator@toktickit.test",
        "ADMINISTRATOR",
      );
      const adminUsers = await page.request.get("/api/admin/users");
      await expectApiStatus(
        "ADMINISTRATOR",
        "get",
        "/api/admin/users",
        adminUsers,
        200,
      );
      const adminQueue = await page.request.get("/api/staff/tickets");
      await expectApiStatus(
        "ADMINISTRATOR",
        "get",
        "/api/staff/tickets",
        adminQueue,
        200,
      );
      const adminReview = await page.request.get(
        `/api/admin/tickets/${requesterBTicket.id}`,
      );
      await expectApiStatus(
        "ADMINISTRATOR",
        "get",
        `/api/admin/tickets/${requesterBTicket.id}`,
        adminReview,
        200,
      );

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Staff Dashboard" }),
      ).toBeVisible();
      await auditCurrentPage(page, "ADMINISTRATOR", "/dashboard");
      await navigateWithButton(
        page,
        "ADMINISTRATOR",
        "User Management",
        "/admin/users",
        "User Management",
      );
      await expect(
        page.getByRole("cell", { name: "administrator@toktickit.test" }),
      ).toBeVisible();
      await auditCurrentPage(page, "ADMINISTRATOR", "/admin/users");
      await navigateWithButton(
        page,
        "ADMINISTRATOR",
        "Ticket Queue",
        "/staff/tickets",
        "Ticket Queue",
      );
      await auditCurrentPage(page, "ADMINISTRATOR", "/staff/tickets");
      await page.goto(`/staff/tickets/${requesterBTicket.id}`);
      await expect(
        page.getByRole("heading", { name: requesterBTicket.ticketNumber }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Post public comment" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Add internal note" }),
      ).toHaveCount(0);
      await auditCurrentPage(
        page,
        "ADMINISTRATOR",
        `/staff/tickets/${requesterBTicket.id}`,
      );

      await navigateWithButton(
        page,
        "ADMINISTRATOR",
        "Ticket Review",
        "/admin/tickets",
        "Administrator Ticket Review",
      );
      await page.getByLabel(/^Ticket ID/).fill(String(requesterBTicket.id));
      await page.getByRole("button", { name: "Open Ticket Review" }).click();
      await expect(
        page.getByRole("heading", { name: requesterBTicket.ticketNumber }),
      ).toBeVisible();
      await expect(page.getByLabel("IT Priority")).toBeVisible();
      await auditCurrentPage(
        page,
        "ADMINISTRATOR",
        `/admin/tickets/${requesterBTicket.id}`,
      );
      await page.getByLabel("IT Priority").selectOption("LOW");
      await page.getByRole("button", { name: "Save IT Priority" }).click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "IT Priority updated successfully." }),
      ).toBeVisible();
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: requesterBTicket.id },
          select: { itPriority: true },
        }),
      ).toEqual({ itPriority: "LOW" });

      await expect(browserConsoleErrors).toEqual([]);
      await expect(pageErrors).toEqual([]);
    } finally {
      await prisma.ticket.update({
        where: { id: requesterBTicket.id },
        data: { itPriority: originalPriority },
      });
      await context.clearCookies();
    }
  });
});
