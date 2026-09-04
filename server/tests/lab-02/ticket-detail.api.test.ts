import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedReferenceData } from "../../prisma/seed-reference-data.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";

const createdTicketIds = new Set<number>();

let requesterAId!: number;
let requesterBId!: number;
let ticketId!: number;

describe("GET /api/tickets/:ticketId", () => {
  beforeAll(async () => {
    await seedReferenceData(prisma);

    const [requesterA, requesterB, category, relatedSystem] = await Promise.all(
      [
        prisma.developmentRequester.findUnique({
          where: { email: "requester-a@toktickit.test" },
          select: { id: true },
        }),
        prisma.developmentRequester.findUnique({
          where: { email: "requester-b@toktickit.test" },
          select: { id: true },
        }),
        prisma.category.findUnique({
          where: { name: "Hardware" },
          select: { id: true },
        }),
        prisma.relatedSystem.findUnique({
          where: { name: "VPN" },
          select: { id: true },
        }),
      ],
    );

    if (!requesterA || !requesterB || !category || !relatedSystem) {
      throw new Error("Expected Lab 2 reference data was not seeded");
    }

    requesterAId = requesterA.id;
    requesterBId = requesterB.id;

    const response = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterAId))
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

  it("returns a complete read-only detail for the selected owner", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Development-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: ticketId,
        requester: { id: requesterAId, name: "Requester A" },
        summary: "Detail endpoint test",
        currentStatus: "NEW",
        attachments: [],
      }),
    );
    expect(response.body.requesterId).toBeUndefined();
    expect(response.body.categoryId).toBeUndefined();
  });

  it("does not disclose a missing or cross-requester Ticket", async () => {
    const crossRequester = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Development-Requester-Id", String(requesterBId));
    const missing = await request(app)
      .get("/api/tickets/999999999")
      .set("X-Development-Requester-Id", String(requesterAId));

    expect(crossRequester.status).toBe(404);
    expect(crossRequester.body).toEqual({
      error: expect.objectContaining({ code: "TICKET_NOT_FOUND" }),
    });
    expect(crossRequester.body.summary).toBeUndefined();
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("validates the requester context and Ticket ID", async () => {
    const missingContext = await request(app).get(`/api/tickets/${ticketId}`);
    const invalidId = await request(app)
      .get("/api/tickets/not-an-id")
      .set("X-Development-Requester-Id", String(requesterAId));

    expect(missingContext.status).toBe(400);
    expect(missingContext.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error.code).toBe("TICKET_ID_INVALID");
  });
});
