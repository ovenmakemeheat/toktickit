import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loginAgent, prepareLab3Data, prisma } from "./test-helpers.js";

let requesterA!: Awaited<ReturnType<typeof loginAgent>>;
let requesterB!: Awaited<ReturnType<typeof loginAgent>>;
let staff!: Awaited<ReturnType<typeof loginAgent>>;
let administrator!: Awaited<ReturnType<typeof loginAgent>>;
let requesterATicketId!: number;
let requesterBTicketId!: number;

beforeAll(async () => {
  await prepareLab3Data();
  await prisma.ticket.updateMany({
    data: { requesterResolutionIndicatedAt: null },
  });
  requesterA = await loginAgent("requester-a@toktickit.test");
  requesterB = await loginAgent("requester-b@toktickit.test");
  staff = await loginAgent("it-staff-a@toktickit.test");
  administrator = await loginAgent("administrator@toktickit.test");
  requesterATicketId = (
    await prisma.ticket.findUniqueOrThrow({
      where: { clientRequestId: "00000000-0000-4000-8000-000000000001" },
      select: { id: true },
    })
  ).id;
  requesterBTicketId = (
    await prisma.ticket.findUniqueOrThrow({
      where: { clientRequestId: "00000000-0000-4000-8000-000000000002" },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Ticket Public Comments, Internal Notes, and resolution indication", () => {
  it("keeps Public Comments visible by role and scoped for Requesters", async () => {
    const requesterComments = await requesterA.agent.get(
      `/api/tickets/${requesterATicketId}/comments`,
    );
    expect(requesterComments.status).toBe(200);
    expect(requesterComments.body).toEqual(expect.any(Array));

    const created = await requesterA.agent
      .post(`/api/tickets/${requesterATicketId}/comments`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ content: "  Requester update <not html>  " });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        content: "Requester update <not html>",
        author: expect.objectContaining({
          id: requesterA.userId,
          role: "REQUESTER",
        }),
      }),
    );

    const staffComments = await staff.agent.get(
      `/api/tickets/${requesterATicketId}/comments`,
    );
    expect(staffComments.status).toBe(200);
    expect(staffComments.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "Requester update <not html>" }),
      ]),
    );

    const crossOwner = await requesterB.agent.get(
      `/api/tickets/${requesterATicketId}/comments`,
    );
    expect(crossOwner.status).toBe(404);
    expect(JSON.stringify(crossOwner.body)).not.toContain("Requester update");

    const administratorComments = await administrator.agent.get(
      `/api/tickets/${requesterATicketId}/comments`,
    );
    expect(administratorComments.status).toBe(200);
  });

  it("validates append-only content and protects Internal Notes", async () => {
    const invalid = await staff.agent
      .post(`/api/tickets/${requesterATicketId}/comments`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ content: "   " });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("COMMENT_INPUT_INVALID");

    const note = await staff.agent
      .post(`/api/tickets/${requesterATicketId}/internal-notes`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ content: "  Private triage detail  " });
    expect(note.status).toBe(201);
    expect(note.body).toEqual(
      expect.objectContaining({
        content: "Private triage detail",
        author: expect.objectContaining({ id: staff.userId, role: "IT_STAFF" }),
      }),
    );

    const requesterNotes = await requesterA.agent.get(
      `/api/tickets/${requesterATicketId}/internal-notes`,
    );
    expect(requesterNotes.status).toBe(403);
    expect(requesterNotes.body.error.code).toBe("INTERNAL_NOTES_FORBIDDEN");
    expect(JSON.stringify(requesterNotes.body)).not.toContain("Private triage");

    const staffNotes = await staff.agent.get(
      `/api/tickets/${requesterATicketId}/internal-notes`,
    );
    expect(staffNotes.status).toBe(200);
    expect(staffNotes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "Private triage detail" }),
      ]),
    );

    const administratorNotes = await administrator.agent.get(
      `/api/tickets/${requesterBTicketId}/internal-notes`,
    );
    expect(administratorNotes.status).toBe(200);
    expect(administratorNotes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("Seed note"),
        }),
      ]),
    );

    const forbiddenPublicMutation = await administrator.agent
      .post(`/api/tickets/${requesterATicketId}/comments`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ content: "Not allowed" });
    expect(forbiddenPublicMutation.status).toBe(403);
    expect(forbiddenPublicMutation.body.error.code).toBe("COMMENT_FORBIDDEN");
  });

  it("records an idempotent Requester resolution indication without changing status", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({
      where: { id: requesterATicketId },
      select: { currentStatus: true },
    });
    const first = await requesterA.agent
      .post(`/api/tickets/${requesterATicketId}/resolution-indication`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ appearsResolved: true });
    expect(first.status).toBe(200);
    expect(first.body.requesterResolutionIndicatedAt).toEqual(
      expect.any(String),
    );

    const second = await requesterA.agent
      .post(`/api/tickets/${requesterATicketId}/resolution-indication`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ appearsResolved: true });
    expect(second.status).toBe(200);
    expect(second.body.requesterResolutionIndicatedAt).toBe(
      first.body.requesterResolutionIndicatedAt,
    );

    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: requesterATicketId },
      select: { currentStatus: true, requesterResolutionIndicatedAt: true },
    });
    expect(after.currentStatus).toBe(before.currentStatus);
    expect(after.requesterResolutionIndicatedAt).not.toBeNull();

    const invalid = await requesterA.agent
      .post(`/api/tickets/${requesterATicketId}/resolution-indication`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ appearsResolved: false });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("RESOLUTION_INDICATION_INVALID");
  });

  it("gives an Administrator read-only Ticket Review with an IT Priority-only mutation", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({
      where: { id: requesterATicketId },
      select: { requestedPriority: true, currentStatus: true },
    });

    const review = await administrator.agent.get(
      `/api/admin/tickets/${requesterATicketId}`,
    );
    expect(review.status, JSON.stringify(review.body)).toBe(200);
    expect(review.body).toEqual(
      expect.objectContaining({
        id: requesterATicketId,
        ticketNumber: expect.stringMatching(/^TT-/),
        requester: expect.objectContaining({ id: expect.any(Number) }),
        category: expect.objectContaining({ id: expect.any(Number) }),
        relatedSystem: expect.objectContaining({ id: expect.any(Number) }),
        requestedPriority: expect.any(String),
        itPriority: expect.any(String),
        currentStatus: expect.any(String),
        description: expect.any(String),
        attachments: expect.any(Array),
        publicComments: expect.any(Array),
        internalNotes: expect.any(Array),
      }),
    );
    expect(
      review.body.owner === null ||
        (typeof review.body.owner === "object" &&
          typeof review.body.owner.name === "string"),
    ).toBe(true);
    expect(review.body.requesterResolutionIndicatedAt).toEqual(
      expect.any(String),
    );
    expect(review.body).not.toHaveProperty("eligibleOwners");
    expect(
      review.body.internalNotes.some(
        (note: { content: string }) =>
          note.content === "Private triage detail" ||
          note.content.includes("Seed note"),
      ),
    ).toBe(true);

    const updated = await administrator.agent
      .patch(`/api/admin/tickets/${requesterATicketId}/priority`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ itPriority: "LOW" });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.itPriority).toBe("LOW");
    expect(updated.body.requestedPriority).toBe(before.requestedPriority);
    expect(updated.body.currentStatus).toBe(before.currentStatus);

    const persisted = await prisma.ticket.findUniqueOrThrow({
      where: { id: requesterATicketId },
      select: {
        itPriority: true,
        requestedPriority: true,
        currentStatus: true,
        primaryOwnerUserId: true,
      },
    });
    expect(persisted.itPriority).toBe("LOW");
    expect(persisted.requestedPriority).toBe(before.requestedPriority);
    expect(persisted.currentStatus).toBe(before.currentStatus);

    await administrator.agent
      .patch(`/api/admin/tickets/${requesterATicketId}/priority`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ itPriority: "MEDIUM" });

    const invalidPriority = await administrator.agent
      .patch(`/api/admin/tickets/${requesterATicketId}/priority`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ itPriority: "URGENT" });
    expect(invalidPriority.status).toBe(400);
    expect(invalidPriority.body.error.code).toBe("IT_PRIORITY_INVALID");

    const missingTicket = await administrator.agent.get(
      "/api/admin/tickets/99999999",
    );
    expect(missingTicket.status).toBe(404);
    expect(missingTicket.body.error.code).toBe("TICKET_NOT_FOUND");

    const invalidId = await administrator.agent.get(
      "/api/admin/tickets/not-a-number",
    );
    expect(invalidId.status).toBe(400);

    const missingCsrf = await administrator.agent
      .patch(`/api/admin/tickets/${requesterATicketId}/priority`)
      .send({ itPriority: "HIGH" });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_TOKEN_INVALID");

    const staffForbidden = await staff.agent.get(
      `/api/admin/tickets/${requesterATicketId}`,
    );
    expect(staffForbidden.status).toBe(403);
    expect(staffForbidden.body.error.code).toBe("ADMIN_TICKET_FORBIDDEN");

    const requesterForbidden = await requesterA.agent
      .patch(`/api/admin/tickets/${requesterATicketId}/priority`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ itPriority: "HIGH" });
    expect(requesterForbidden.status).toBe(403);
    expect(requesterForbidden.body.error.code).toBe("ADMIN_TICKET_FORBIDDEN");

    const noMutationControls = await administrator.agent
      .post(`/api/admin/tickets/${requesterATicketId}/claim`)
      .set("X-CSRF-Token", administrator.csrfToken);
    expect(noMutationControls.status).toBe(404);
  });
});
