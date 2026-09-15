import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loginAgent, prepareLab3Data, prisma } from "./test-helpers.js";

let staff!: Awaited<ReturnType<typeof loginAgent>>;
let requester!: Awaited<ReturnType<typeof loginAgent>>;
let ticketId!: number;

beforeAll(async () => {
  await prepareLab3Data();
  staff = await loginAgent("it-staff-a@toktickit.test");
  requester = await loginAgent("requester-a@toktickit.test");
  const ticket = await prisma.ticket.findFirstOrThrow({
    where: { currentStatus: "NEW" },
    select: { id: true },
  });
  ticketId = ticket.id;
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      primaryOwnerUserId: null,
      itPriority: "HIGH",
      currentStatus: "NEW",
      requesterResolutionIndicatedAt: null,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("IT Staff Ticket operations", () => {
  it("returns staff detail without requester ownership isolation", async () => {
    const response = await staff.agent.get(`/api/staff/tickets/${ticketId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: ticketId,
        requester: expect.objectContaining({ name: expect.any(String) }),
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        currentStatus: "NEW",
        owner: null,
        requesterResolutionIndicatedAt: null,
        attachments: expect.any(Array),
        publicComments: expect.any(Array),
        internalNotes: expect.any(Array),
        updatedAt: expect.any(String),
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain("storageKey");
  });

  it("claims only unassigned Tickets and validates owner targets", async () => {
    const claimed = await staff.agent
      .post(`/api/staff/tickets/${ticketId}/claim`)
      .set("X-CSRF-Token", staff.csrfToken);
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
    expect(claimed.body.owner).toEqual(
      expect.objectContaining({ id: staff.userId, role: "IT_STAFF" }),
    );

    const conflict = await staff.agent
      .post(`/api/staff/tickets/${ticketId}/claim`)
      .set("X-CSRF-Token", staff.csrfToken);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("TICKET_ALREADY_ASSIGNED");

    const inactive = await prisma.user.findUniqueOrThrow({
      where: { email: "inactive-it-staff@toktickit.test" },
      select: { id: true },
    });
    const invalid = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ ownerId: inactive.id });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("OWNER_INVALID");

    const unchanged = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { primaryOwnerUserId: true },
    });
    expect(unchanged.primaryOwnerUserId).toBe(staff.userId);

    const administrator = await prisma.user.findUniqueOrThrow({
      where: { email: "administrator@toktickit.test" },
      select: { id: true },
    });
    const reassigned = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ ownerId: administrator.id });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.owner).toEqual(
      expect.objectContaining({ id: administrator.id, role: "ADMINISTRATOR" }),
    );
  });

  it("changes IT Priority without changing Requested Priority", async () => {
    const response = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ itPriority: "LOW" });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.itPriority).toBe("LOW");
    expect(response.body.requestedPriority).toBe("HIGH");

    const invalid = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/priority`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ itPriority: "URGENT" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("IT_PRIORITY_INVALID");
  });

  it("enforces status transitions, confirmation, CSRF, and role boundaries", async () => {
    const open = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ status: "OPEN", confirmation: false });
    expect(open.status, JSON.stringify(open.body)).toBe(200);
    expect(open.body.currentStatus).toBe("OPEN");

    const missingConfirmation = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ status: "RESOLVED", confirmation: false });
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error.code).toBe(
      "STATUS_CONFIRMATION_REQUIRED",
    );
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } }))
        .currentStatus,
    ).toBe("OPEN");

    const resolved = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ status: "RESOLVED", confirmation: true });
    expect(resolved.status).toBe(200);
    expect(resolved.body.currentStatus).toBe("RESOLVED");

    const invalidTransition = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ status: "OPEN", confirmation: true });
    expect(invalidTransition.status).toBe(400);
    expect(invalidTransition.body.error.code).toBe(
      "TICKET_STATUS_TRANSITION_INVALID",
    );

    const missingCsrf = await staff.agent
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .send({ status: "CLOSED", confirmation: true });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_TOKEN_INVALID");

    const forbidden = await requester.agent.get(
      `/api/staff/tickets/${ticketId}`,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("STAFF_TICKET_FORBIDDEN");
  });
});
