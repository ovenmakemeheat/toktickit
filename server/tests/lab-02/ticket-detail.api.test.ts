import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  loginAgent,
  prepareLab3Data,
  prisma,
} from "../lab-03/test-helpers.js";

const createdTicketIds = new Set<number>();

let requesterA!: Awaited<ReturnType<typeof loginAgent>>;
let requesterB!: Awaited<ReturnType<typeof loginAgent>>;
let ticketId!: number;

describe("GET /api/tickets/:ticketId", () => {
  beforeAll(async () => {
    await prepareLab3Data();
    requesterA = await loginAgent("requester-a@toktickit.test");
    requesterB = await loginAgent("requester-b@toktickit.test");

    const [category, relatedSystem] = await Promise.all([
      prisma.category.findUnique({
        where: { name: "Hardware" },
        select: { id: true },
      }),
      prisma.relatedSystem.findUnique({
        where: { name: "VPN" },
        select: { id: true },
      }),
    ]);
    if (!category || !relatedSystem) {
      throw new Error("Expected Lab 3 reference data was not seeded");
    }

    const response = await requesterA.agent
      .post("/api/tickets")
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({
        clientRequestId: randomUUID(),
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "HIGH",
        summary: "Detail endpoint test",
        description: "The ticket detail endpoint needs a readable fixture.",
      });

    expect(response.status).toBe(201);
    ticketId = response.body.id;
    createdTicketIds.add(ticketId);
  });

  afterAll(async () => {
    if (createdTicketIds.size > 0) {
      await prisma.attachment.deleteMany({
        where: { ticketId: { in: [...createdTicketIds] } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: [...createdTicketIds] } },
      });
    }
    await prisma.$disconnect();
  });

  it("returns a complete read-only detail for the authenticated owner", async () => {
    const response = await requesterA.agent.get(`/api/tickets/${ticketId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: ticketId,
        requester: { id: requesterA.userId, name: "Requester A" },
        summary: "Detail endpoint test",
        currentStatus: "NEW",
        attachments: [],
      }),
    );
    expect(response.body.requesterId).toBeUndefined();
    expect(response.body.categoryId).toBeUndefined();
  });

  it("does not disclose a missing or cross-requester Ticket", async () => {
    const crossRequester = await requesterB.agent.get(
      `/api/tickets/${ticketId}`,
    );
    const missing = await requesterA.agent.get("/api/tickets/999999999");

    expect(crossRequester.status).toBe(404);
    expect(crossRequester.body).toEqual({
      error: expect.objectContaining({ code: "TICKET_NOT_FOUND" }),
    });
    expect(crossRequester.body.summary).toBeUndefined();
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("validates the session and Ticket ID", async () => {
    const missingSession = await request(app).get(`/api/tickets/${ticketId}`);
    const invalidId = await requesterA.agent.get("/api/tickets/not-an-id");

    expect(missingSession.status).toBe(401);
    expect(missingSession.body.error.code).toBe("SESSION_REQUIRED");
    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error.code).toBe("TICKET_ID_INVALID");
  });
});
