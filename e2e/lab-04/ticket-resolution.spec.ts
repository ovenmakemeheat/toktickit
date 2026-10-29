import { expect, test, type Page } from "@playwright/test";

import {
  cleanupSeededTicket,
  createSeededTicket,
  loginSeededUser,
  prisma,
} from "./seeded-helpers.js";

async function recordAction(
  page: Page,
  actionDescription: string,
  result: string,
) {
  const actions = page.locator(
    'section[aria-labelledby="actions-taken-title"]',
  );
  await actions.getByRole("button", { name: "Add Action Taken" }).click();
  await page.getByLabel("Action Description").fill(actionDescription);
  await page.getByLabel("Result").fill(result);
  await actions.getByRole("button", { name: "Record Action Taken" }).click();
  await expect(
    actions.getByRole("status").filter({ hasText: "Action Taken recorded." }),
  ).toBeVisible();
}

async function confirmStatus(page: Page, status: string) {
  await page.getByLabel("Status", { exact: true }).selectOption(status);
  await page
    .getByRole("checkbox", { name: `Confirm change to ${statusLabel(status)}` })
    .check();
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Ticket status updated successfully." }),
  ).toBeVisible();
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

test.describe("Lab 4 seeded resolution gate journey", () => {
  test("keeps the Requester signal advisory and resolves only after work and confirmation", async ({
    page,
    context,
  }) => {
    const ticket = await createSeededTicket({
      requesterEmail: "requester-a@toktickit.test",
      ownerEmail: "it-staff-a@toktickit.test",
      status: "OPEN",
    });

    try {
      await loginSeededUser(page, "requester-a@toktickit.test", "REQUESTER");
      await page.goto(`/tickets/${ticket.id}`);
      await page
        .getByRole("button", { name: "Problem Appears Resolved" })
        .click();
      await expect(
        page.getByRole("status").filter({
          hasText: "Your indication was recorded. IT Staff remain responsible",
        }),
      ).toBeVisible();
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: ticket.id },
          select: { currentStatus: true, requesterResolutionIndicatedAt: true },
        }),
      ).toMatchObject({
        currentStatus: "OPEN",
        requesterResolutionIndicatedAt: expect.any(Date),
      });

      await context.clearCookies();
      const staff = await loginSeededUser(
        page,
        "it-staff-a@toktickit.test",
        "IT_STAFF",
      );
      await page.goto(`/staff/tickets/${ticket.id}`);
      const statusSelect = page.getByLabel("Status", { exact: true });
      await expect(
        statusSelect.locator('option[value="RESOLVED"]'),
      ).toBeDisabled();

      const rejected = await page.request.patch(
        `/api/staff/tickets/${ticket.id}/status`,
        {
          headers: { "X-CSRF-Token": staff.csrfToken },
          data: {
            expectedStatus: "OPEN",
            status: "RESOLVED",
            confirmation: true,
          },
        },
      );
      expect(rejected.status()).toBe(409);
      expect(await rejected.json()).toMatchObject({
        error: { code: "ACTION_TAKEN_REQUIRED" },
      });
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: ticket.id },
          select: { currentStatus: true, resolvedAt: true },
        }),
      ).toEqual({ currentStatus: "OPEN", resolvedAt: null });

      await recordAction(
        page,
        "Repaired the email authentication service.",
        "The Requester can now sign in from a fresh browser session.",
      );
      await expect(
        statusSelect.locator('option[value="RESOLVED"]'),
      ).toBeEnabled();
      await statusSelect.selectOption("RESOLVED");
      await expect(
        page.getByRole("checkbox", { name: "Confirm change to Resolved" }),
      ).not.toBeChecked();
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByRole("alert")).toContainText(
        "Confirm this status change before saving it.",
      );

      await page
        .getByRole("checkbox", { name: "Confirm change to Resolved" })
        .check();
      const competingUpdate = await page.request.patch(
        `/api/staff/tickets/${ticket.id}/status`,
        {
          headers: { "X-CSRF-Token": staff.csrfToken },
          data: {
            expectedStatus: "OPEN",
            status: "IN_PROGRESS",
            confirmation: false,
          },
        },
      );
      expect(competingUpdate.status()).toBe(200);

      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByRole("alert")).toContainText(
        "This Ticket status changed elsewhere. Refresh before trying again.",
      );
      await expect(
        page.getByRole("button", { name: "Refresh Ticket" }),
      ).toBeVisible();
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: ticket.id },
          select: { currentStatus: true, resolvedAt: true },
        }),
      ).toEqual({ currentStatus: "IN_PROGRESS", resolvedAt: null });

      await page.getByRole("button", { name: "Refresh Ticket" }).click();
      await expect(page.getByLabel("Current Status")).toHaveValue(
        "In Progress",
      );
      await confirmStatus(page, "RESOLVED");
      const resolved = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { currentStatus: true, resolvedAt: true },
      });
      expect(resolved.currentStatus).toBe("RESOLVED");
      expect(resolved.resolvedAt).toBeInstanceOf(Date);
    } finally {
      await cleanupSeededTicket(ticket.id);
      await context.clearCookies();
    }
  });

  test("requires new work recorded after reopening before resolving again", async ({
    page,
    context,
  }) => {
    const ticket = await createSeededTicket({
      requesterEmail: "requester-a@toktickit.test",
      ownerEmail: "it-staff-a@toktickit.test",
      status: "OPEN",
    });

    try {
      const staff = await loginSeededUser(
        page,
        "it-staff-a@toktickit.test",
        "IT_STAFF",
      );
      await page.goto(`/staff/tickets/${ticket.id}`);
      await recordAction(
        page,
        "Verified the identity provider configuration.",
        "The first sign-in attempt now succeeds.",
      );
      await confirmStatus(page, "RESOLVED");
      await confirmStatus(page, "REOPENED");

      const reopened = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { currentStatus: true, resolvedAt: true, lastReopenedAt: true },
      });
      expect(reopened).toMatchObject({
        currentStatus: "REOPENED",
        resolvedAt: null,
        lastReopenedAt: expect.any(Date),
      });
      await expect(
        page
          .getByLabel("Status", { exact: true })
          .locator('option[value="RESOLVED"]'),
      ).toBeDisabled();

      const rejected = await page.request.patch(
        `/api/staff/tickets/${ticket.id}/status`,
        {
          headers: { "X-CSRF-Token": staff.csrfToken },
          data: {
            expectedStatus: "REOPENED",
            status: "RESOLVED",
            confirmation: true,
          },
        },
      );
      expect(rejected.status()).toBe(409);
      expect(await rejected.json()).toMatchObject({
        error: { code: "ACTION_TAKEN_REQUIRED" },
      });

      await recordAction(
        page,
        "Applied the follow-up repair after the Ticket was reopened.",
        "The recurring authentication error no longer appears.",
      );
      await expect(
        page
          .getByLabel("Status", { exact: true })
          .locator('option[value="RESOLVED"]'),
      ).toBeEnabled();
      await confirmStatus(page, "RESOLVED");

      const finalState = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { currentStatus: true, resolvedAt: true },
      });
      expect(finalState.currentStatus).toBe("RESOLVED");
      expect(finalState.resolvedAt).toBeInstanceOf(Date);
      expect(
        await prisma.actionTaken.count({ where: { ticketId: ticket.id } }),
      ).toBe(2);
    } finally {
      await cleanupSeededTicket(ticket.id);
      await context.clearCookies();
    }
  });
});
