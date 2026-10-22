import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  cleanupSeededTicket,
  createSeededTicket,
  loginSeededUser,
  prisma,
} from "./seeded-helpers.js";

function localDateTime(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

test.describe("Lab 4 seeded Actions Taken journey", () => {
  test("Staff creates and edits work; the owning Requester sees read-only history", async ({
    page,
    context,
  }) => {
    const requesterEmail = "requester-a@toktickit.test";
    const ownerEmail = "it-staff-b@toktickit.test";
    const ticket = await createSeededTicket({
      requesterEmail,
      ownerEmail,
      status: "OPEN",
    });

    try {
      const staff = await loginSeededUser(
        page,
        "it-staff-a@toktickit.test",
        "IT_STAFF",
      );
      await page.goto(`/staff/tickets/${ticket.id}`);
      await expect(
        page.getByRole("heading", { name: ticket.ticketNumber }),
      ).toBeVisible();

      const actions = page.locator(
        'section[aria-labelledby="actions-taken-title"]',
      );
      await expect(
        actions.getByText(
          "No Actions Taken have been recorded for this Ticket.",
        ),
      ).toBeVisible();
      await actions.getByRole("button", { name: "Add Action Taken" }).click();
      await page
        .getByLabel("Action Date/Time")
        .fill(localDateTime(new Date(Date.now() - 60_000)));
      await page
        .getByLabel("Action Description")
        .fill("Restarted the email authentication service.");
      await page
        .getByLabel("Result")
        .fill("A fresh sign-in completed successfully.");
      await page.getByLabel("Follow-Up Required?").selectOption("yes");
      await page
        .getByLabel("Follow-up Note")
        .fill(
          "Confirm the service remains stable after the next scheduled update.",
        );
      await page
        .getByLabel("Attachment Notes")
        .fill(
          "Reviewed the existing service status attachment; no file uploaded.",
        );
      await actions
        .getByRole("button", { name: "Record Action Taken" })
        .click();
      await expect(
        actions
          .getByRole("status")
          .filter({ hasText: "Action Taken recorded." }),
      ).toBeVisible();

      const created = await prisma.actionTaken.findFirstOrThrow({
        where: { ticketId: ticket.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          version: true,
          actionDescription: true,
          result: true,
          followUpRequired: true,
          followUpNote: true,
          attachmentNotes: true,
          performedByUserId: true,
          updatedByUserId: true,
          createdAt: true,
        },
      });
      expect(created).toMatchObject({
        version: 1,
        actionDescription: "Restarted the email authentication service.",
        result: "A fresh sign-in completed successfully.",
        followUpRequired: true,
        followUpNote:
          "Confirm the service remains stable after the next scheduled update.",
        attachmentNotes:
          "Reviewed the existing service status attachment; no file uploaded.",
        performedByUserId: staff.user.id,
        updatedByUserId: null,
      });

      const afterCreate = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { primaryOwnerUserId: true, updatedAt: true },
      });
      expect(afterCreate.primaryOwnerUserId).toBe(ticket.primaryOwnerUserId);
      expect(afterCreate.updatedAt.getTime()).toBeGreaterThan(
        ticket.updatedAt.getTime(),
      );
      expect(afterCreate.primaryOwnerUserId).not.toBe(staff.user.id);

      const actionRow = page.locator(`#action-taken-${created.id}`);
      await actionRow
        .getByRole("button", { name: "Edit Action Taken" })
        .click();
      await page
        .getByLabel("Result")
        .fill(
          "The Requester confirmed the sign-in now works from a new session.",
        );
      await actions.getByRole("button", { name: "Save Action Taken" }).click();
      await expect(
        actions
          .getByRole("status")
          .filter({ hasText: "Action Taken updated." }),
      ).toBeVisible();

      const updated = await prisma.actionTaken.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          version: true,
          result: true,
          performedByUserId: true,
          updatedByUserId: true,
          createdAt: true,
        },
      });
      expect(updated).toMatchObject({
        version: 2,
        result:
          "The Requester confirmed the sign-in now works from a new session.",
        performedByUserId: staff.user.id,
        updatedByUserId: staff.user.id,
      });
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: ticket.id },
          select: { primaryOwnerUserId: true },
        }),
      ).toEqual({ primaryOwnerUserId: ticket.primaryOwnerUserId });

      const replayKey = randomUUID();
      const replayInput = {
        actionAt: new Date().toISOString(),
        actionDescription: "Confirmed the service from a separate session.",
        result: "The login flow remained available after a fresh sign-in.",
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
      };
      const firstReplayable = await page.request.post(
        `/api/tickets/${ticket.id}/actions-taken`,
        {
          headers: {
            "X-CSRF-Token": staff.csrfToken,
            "Idempotency-Key": replayKey,
          },
          data: replayInput,
        },
      );
      expect(firstReplayable.status()).toBe(201);
      const replayableAction = (await firstReplayable.json()) as { id: number };
      const activityAfterCreate = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { updatedAt: true },
      });
      const retry = await page.request.post(
        `/api/tickets/${ticket.id}/actions-taken`,
        {
          headers: {
            "X-CSRF-Token": staff.csrfToken,
            "Idempotency-Key": replayKey,
          },
          data: replayInput,
        },
      );
      expect(retry.status()).toBe(200);
      expect((await retry.json()).id).toBe(replayableAction.id);
      expect(
        await prisma.actionTaken.count({ where: { ticketId: ticket.id } }),
      ).toBe(2);
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: ticket.id },
          select: { updatedAt: true },
        }),
      ).toEqual(activityAfterCreate);

      await context.clearCookies();
      await loginSeededUser(page, requesterEmail, "REQUESTER");
      await page.goto(`/tickets/${ticket.id}`);
      await expect(
        page.getByRole("heading", { name: ticket.ticketNumber }),
      ).toBeVisible();
      await expect(
        actions.getByText("Restarted the email authentication service."),
      ).toBeVisible();
      await expect(
        actions.getByText(
          "The Requester confirmed the sign-in now works from a new session.",
        ),
      ).toBeVisible();
      await expect(
        actions.getByText("Performed by IT Staff A").first(),
      ).toBeVisible();
      await expect(
        actions.getByText(
          "Confirm the service remains stable after the next scheduled update.",
        ),
      ).toBeVisible();
      await expect(
        actions.getByText("Confirmed the service from a separate session."),
      ).toBeVisible();
      await expect(
        actions.getByRole("button", { name: "Add Action Taken" }),
      ).toHaveCount(0);
      await expect(
        actions.getByRole("button", { name: "Edit Action Taken" }),
      ).toHaveCount(0);
      await expect(actions.locator('input[type="file"]')).toHaveCount(0);
      await expect(actions.getByRole("button")).toHaveCount(0);
    } finally {
      await cleanupSeededTicket(ticket.id);
      await context.clearCookies();
    }
  });
});
