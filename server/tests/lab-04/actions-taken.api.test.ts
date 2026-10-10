import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deleteTickets,
  loginAgent,
  prepareLab3Data,
  prisma,
} from "../lab-03/test-helpers.js";

const validAction = {
  actionAt: "2026-10-07T14:30:00+01:00",
  actionDescription: "Reset the account lock and verified sign-in.",
  result: "The Requester can sign in successfully.",
  followUpRequired: true,
  followUpNote: "Confirm access after the next class.",
  attachmentNotes: "See the existing login-error.png attachment.",
};

let requesterA!: Awaited<ReturnType<typeof loginAgent>>;
let requesterB!: Awaited<ReturnType<typeof loginAgent>>;
let staffA!: Awaited<ReturnType<typeof loginAgent>>;
let staffB!: Awaited<ReturnType<typeof loginAgent>>;
let administrator!: Awaited<ReturnType<typeof loginAgent>>;
let ticketIds: number[] = [];

async function createTicket(ownerUserId = staffA.userId) {
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
      requesterUserId: requesterA.userId,
      primaryOwnerUserId: ownerUserId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "HIGH",
      itPriority: "MEDIUM",
      currentStatus: "OPEN",
      summary: "Cannot access course email",
      description: "The service desk needs to investigate sign-in.",
      updatedAt: new Date(Date.now() - 60_000),
    },
    select: { id: true },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

beforeAll(async () => {
  await prepareLab3Data();
  requesterA = await loginAgent("requester-a@toktickit.test");
  requesterB = await loginAgent("requester-b@toktickit.test");
  staffA = await loginAgent("it-staff-a@toktickit.test");
  staffB = await loginAgent("it-staff-b@toktickit.test");
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

describe("Ticket-scoped Actions Taken API", () => {
  it("records the authenticated performer without changing the Ticket Owner and replays safely after an edit", async () => {
    const ticketId = await createTicket();
    const originalUpdatedAt = (
      await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: { updatedAt: true },
      })
    ).updatedAt;
    const idempotencyKey = randomUUID();

    const created = await staffB.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffB.csrfToken)
      .set("Idempotency-Key", idempotencyKey)
      .send(validAction);

    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        ticketId,
        actionAt: "2026-10-07T13:30:00.000Z",
        actionDescription: validAction.actionDescription,
        result: validAction.result,
        performedBy: {
          id: staffB.userId,
          name: "IT Staff B",
          role: "IT_STAFF",
        },
        followUpRequired: true,
        followUpNote: validAction.followUpNote,
        version: 1,
        updatedBy: null,
      }),
    );
    expect(created.body).not.toHaveProperty("idempotencyKey");
    expect(created.body).not.toHaveProperty("requestFingerprint");
    const createdId = created.body.id as number;

    const ownerAfterCreate = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { primaryOwnerUserId: true, updatedAt: true },
    });
    expect(ownerAfterCreate.primaryOwnerUserId).toBe(staffA.userId);
    expect(ownerAfterCreate.updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime(),
    );

    const edited = await staffB.agent
      .patch(`/api/tickets/${ticketId}/actions-taken/${createdId}`)
      .set("X-CSRF-Token", staffB.csrfToken)
      .send({
        expectedVersion: 1,
        actionDescription: "Corrected: reset the account lock.",
      });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect(edited.body).toEqual(
      expect.objectContaining({
        actionDescription: "Corrected: reset the account lock.",
        performedBy: expect.objectContaining({ id: staffB.userId }),
        updatedBy: expect.objectContaining({ id: staffB.userId }),
        version: 2,
      }),
    );
    const ticketActivityAfterEdit = (
      await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: { updatedAt: true },
      })
    ).updatedAt;

    const replay = await staffB.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffB.csrfToken)
      .set("Idempotency-Key", idempotencyKey)
      .send({ ...validAction, actionAt: "2026-10-07T13:30:00Z" });

    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.id).toBe(createdId);
    expect(replay.body.actionDescription).toBe(
      "Corrected: reset the account lock.",
    );
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);
    expect(
      (
        await prisma.ticket.findUniqueOrThrow({
          where: { id: ticketId },
          select: { updatedAt: true },
        })
      ).updatedAt,
    ).toEqual(ticketActivityAfterEdit);

    const reused = await staffB.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffB.csrfToken)
      .set("Idempotency-Key", idempotencyKey)
      .send({ ...validAction, result: "A different request." });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);
  });

  it("orders actions by action time and stable ID and hides non-owned Tickets from Requesters", async () => {
    const ticketId = await createTicket();
    const first = await staffA.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffA.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ ...validAction, actionAt: "2026-10-07T10:00:00Z" });
    const second = await administrator.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ ...validAction, actionAt: "2026-10-07T10:00:00Z" });
    const earlier = await staffB.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffB.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ ...validAction, actionAt: "2026-10-06T10:00:00Z" });
    expect([first.status, second.status, earlier.status]).toEqual([
      201, 201, 201,
    ]);

    const history = await requesterA.agent.get(
      `/api/tickets/${ticketId}/actions-taken`,
    );
    expect(history.status).toBe(200);
    expect(history.body.items.map((entry: { id: number }) => entry.id)).toEqual(
      [earlier.body.id, first.body.id, second.body.id],
    );

    const hidden = await requesterB.agent.get(
      `/api/tickets/${ticketId}/actions-taken`,
    );
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("validates requests, denies Requester writes, and preserves winning edits on stale versions", async () => {
    const ticketId = await createTicket();
    const missingCsrf = await staffA.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("Idempotency-Key", randomUUID())
      .send(validAction);
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_TOKEN_INVALID");

    const badKey = await staffA.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffA.csrfToken)
      .set("Idempotency-Key", "not-a-uuid")
      .send(validAction);
    expect(badKey.status).toBe(400);
    expect(badKey.body.error.code).toBe("ACTION_TAKEN_IDEMPOTENCY_KEY_INVALID");

    const callerSelectedActor = await staffA.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffA.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ ...validAction, performedByUserId: staffB.userId });
    expect(callerSelectedActor.status).toBe(400);
    expect(callerSelectedActor.body.error.code).toBe(
      "ACTION_TAKEN_INPUT_INVALID",
    );

    const requesterWrite = await requesterA.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send(validAction);
    expect(requesterWrite.status).toBe(403);
    expect(requesterWrite.body.error.code).toBe("ACTION_TAKEN_FORBIDDEN");

    const created = await staffA.agent
      .post(`/api/tickets/${ticketId}/actions-taken`)
      .set("X-CSRF-Token", staffA.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ ...validAction, followUpRequired: false });
    expect(created.status).toBe(201);
    expect(created.body.followUpNote).toBeNull();

    const requesterEdit = await requesterA.agent
      .patch(`/api/tickets/${ticketId}/actions-taken/${created.body.id}`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ expectedVersion: 1, result: "Requester edit is denied." });
    expect(requesterEdit.status).toBe(403);
    expect(requesterEdit.body.error.code).toBe("ACTION_TAKEN_FORBIDDEN");

    const corrected = await staffB.agent
      .patch(`/api/tickets/${ticketId}/actions-taken/${created.body.id}`)
      .set("X-CSRF-Token", staffB.csrfToken)
      .send({
        expectedVersion: 1,
        actionDescription: "Winner: checked the account state.",
      });
    expect(corrected.status).toBe(200);

    const stale = await staffA.agent
      .patch(`/api/tickets/${ticketId}/actions-taken/${created.body.id}`)
      .set("X-CSRF-Token", staffA.csrfToken)
      .send({ expectedVersion: 1, result: "Stale overwrite" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("ACTION_TAKEN_CONFLICT");
    expect(
      await prisma.actionTaken.findUniqueOrThrow({
        where: { id: created.body.id },
        select: { actionDescription: true, result: true, version: true },
      }),
    ).toEqual({
      actionDescription: "Winner: checked the account state.",
      result: validAction.result,
      version: 2,
    });
  });

  it("allows Administrator operations but preserves read-only communication permissions", async () => {
    const ticketId = await createTicket();

    const queue = await administrator.agent.get("/api/staff/tickets");
    expect(queue.status).toBe(200);
    const detail = await administrator.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(detail.status).toBe(200);

    const status = await administrator.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        expectedStatus: "OPEN",
        status: "IN_PROGRESS",
        confirmation: false,
      });
    expect(status.status).toBe(200);
    expect(status.body.currentStatus).toBe("IN_PROGRESS");

    const comment = await administrator.agent
      .post(`/api/tickets/${ticketId}/comments`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ content: "Administrator cannot author a comment." });
    expect(comment.status).toBe(403);

    const note = await administrator.agent
      .post(`/api/tickets/${ticketId}/internal-notes`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ content: "Administrator cannot author a note." });
    expect(note.status).toBe(403);

    const requesterDenied = await requesterA.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(requesterDenied.status).toBe(403);
    expect(requesterDenied.body.error.code).toBe("STAFF_TICKET_FORBIDDEN");
  });
});
