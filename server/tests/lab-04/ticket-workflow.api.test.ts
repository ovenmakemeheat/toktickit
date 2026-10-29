import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deleteTickets,
  loginAgent,
  prepareLab3Data,
  prisma,
} from "../lab-03/test-helpers.js";

let requester!: Awaited<ReturnType<typeof loginAgent>>;
let staff!: Awaited<ReturnType<typeof loginAgent>>;
let administrator!: Awaited<ReturnType<typeof loginAgent>>;
let ticketIds: number[] = [];

async function createTicket(status: "OPEN" | "REOPENED" = "OPEN") {
  const category = await prisma.category.findFirstOrThrow({
    where: { name: "Software" },
    select: { id: true },
  });
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({
    where: { name: "Email" },
    select: { id: true },
  });
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-20261008-${randomUUID().slice(0, 8).toUpperCase()}`,
      clientRequestId: randomUUID(),
      ticketDate: new Date("2026-10-08T08:00:00.000Z"),
      requesterUserId: requester.userId,
      primaryOwnerUserId: staff.userId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status,
      lastReopenedAt: status === "REOPENED" ? new Date() : null,
      summary: "Cannot access course email",
      description: "The service desk needs to investigate sign-in.",
    },
    select: { id: true },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

async function createAction(ticketId: number) {
  return staff.agent
    .post(`/api/tickets/${ticketId}/actions-taken`)
    .set("X-CSRF-Token", staff.csrfToken)
    .set("Idempotency-Key", randomUUID())
    .send({
      actionAt: new Date().toISOString(),
      actionDescription: "Tested the account and reset the lock.",
      result: "Sign-in succeeded.",
      followUpRequired: false,
      attachmentNotes: null,
    });
}

async function transition(
  ticketId: number,
  expectedStatus: string,
  status: string,
  agent = staff,
  confirmation = true,
) {
  return agent.agent
    .patch(`/api/staff/tickets/${ticketId}/status`)
    .set("X-CSRF-Token", agent.csrfToken)
    .send({ expectedStatus, status, confirmation });
}

beforeAll(async () => {
  await prepareLab3Data();
  requester = await loginAgent("requester-a@toktickit.test");
  staff = await loginAgent("it-staff-a@toktickit.test");
  administrator = await loginAgent("administrator@toktickit.test");
});

afterEach(async () => {
  await prisma.actionTaken.deleteMany({
    where: { ticketId: { in: ticketIds } },
  });
  await deleteTickets(ticketIds);
  ticketIds = [];
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Ticket status and resolution workflow", () => {
  it("requires real Actions Taken before resolution and after each reopen", async () => {
    const ticketId = await createTicket();
    const initialDetail = await staff.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(initialDetail.status).toBe(200);
    expect(initialDetail.body.hasEligibleResolutionAction).toBe(false);

    const rejected = await transition(ticketId, "OPEN", "RESOLVED");
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("ACTION_TAKEN_REQUIRED");
    expect(
      await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: { currentStatus: true, resolvedAt: true },
      }),
    ).toEqual({ currentStatus: "OPEN", resolvedAt: null });

    const advisory = await requester.agent
      .post(`/api/tickets/${ticketId}/resolution-indication`)
      .set("X-CSRF-Token", requester.csrfToken)
      .send({ appearsResolved: true });
    expect(advisory.status).toBe(200);

    const stillRejected = await transition(ticketId, "OPEN", "RESOLVED");
    expect(stillRejected.status).toBe(409);
    expect(stillRejected.body.error.code).toBe("ACTION_TAKEN_REQUIRED");

    const firstAction = await createAction(ticketId);
    expect(firstAction.status).toBe(201);
    const eligibleDetail = await staff.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(eligibleDetail.body.hasEligibleResolutionAction).toBe(true);
    const resolved = await transition(ticketId, "OPEN", "RESOLVED");
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedAt).toEqual(expect.any(String));
    const firstResolvedAt = new Date(resolved.body.resolvedAt as string);

    const closed = await transition(ticketId, "RESOLVED", "CLOSED");
    expect(closed.status).toBe(200);
    expect(new Date(closed.body.resolvedAt as string)).toEqual(firstResolvedAt);

    const reopened = await transition(ticketId, "CLOSED", "REOPENED");
    expect(reopened.status).toBe(200);
    expect(reopened.body.resolvedAt).toBeNull();
    const reopenMarker = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { lastReopenedAt: true },
    });
    expect(reopenMarker.lastReopenedAt).toBeInstanceOf(Date);
    const reopenedDetail = await staff.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(reopenedDetail.body.hasEligibleResolutionAction).toBe(false);

    const requiresNewAction = await transition(
      ticketId,
      "REOPENED",
      "RESOLVED",
    );
    expect(requiresNewAction.status).toBe(409);
    expect(requiresNewAction.body.error.code).toBe("ACTION_TAKEN_REQUIRED");

    const secondAction = await createAction(ticketId);
    expect(secondAction.status).toBe(201);
    const eligibleAgain = await staff.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(eligibleAgain.body.hasEligibleResolutionAction).toBe(true);
    const resolvedAgain = await transition(ticketId, "REOPENED", "RESOLVED");
    expect(resolvedAgain.status).toBe(200);
    expect(resolvedAgain.body.currentStatus).toBe("RESOLVED");
  });

  it("requires expected status, confirmation, and a permitted transition", async () => {
    const ticketId = await createTicket();
    const missingExpected = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ status: "IN_PROGRESS", confirmation: false });
    expect(missingExpected.status).toBe(400);
    expect(missingExpected.body.error.code).toBe("TICKET_STATUS_INPUT_INVALID");

    const stale = await transition(
      ticketId,
      "NEW",
      "IN_PROGRESS",
      staff,
      false,
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("TICKET_STATUS_CONFLICT");

    const invalid = await transition(ticketId, "OPEN", "CLOSED");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("TICKET_STATUS_TRANSITION_INVALID");

    const missingConfirmation = await transition(
      ticketId,
      "OPEN",
      "CANCELLED",
      staff,
      false,
    );
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error.code).toBe(
      "STATUS_CONFIRMATION_REQUIRED",
    );

    const adminTransition = await transition(
      ticketId,
      "OPEN",
      "IN_PROGRESS",
      administrator,
      false,
    );
    expect(adminTransition.status).toBe(200);
    expect(adminTransition.body.currentStatus).toBe("IN_PROGRESS");
    expect(adminTransition.body).not.toHaveProperty("lastReopenedAt");
  });
});
