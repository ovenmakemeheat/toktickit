import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedReferenceData } from "../../prisma/seed-reference-data.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import { ticketNumberPattern } from "../../src/services/ticket-number-service.js";

type TicketInput = {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  description: string;
};

const createdTicketIds = new Set<number>();

let requesterId!: number;
let inactiveRequesterId!: number;
let categoryId!: number;
let relatedSystemId!: number;
let inactiveCategoryId!: number;
let inactiveRelatedSystemId!: number;

function buildInput(overrides: Partial<TicketInput> = {}): TicketInput {
  return {
    clientRequestId: randomUUID(),
    categoryId,
    relatedSystemId,
    requestedPriority: "MEDIUM",
    summary: "VPN connection fails",
    description: "The VPN connection fails after entering the credentials.",
    ...overrides,
  };
}

function expectError(response: request.Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.objectContaining({ code }),
  });
}

describe("POST /api/tickets", () => {
  beforeAll(async () => {
    await seedReferenceData(prisma);

    const requester = await prisma.developmentRequester.findUnique({
      where: { email: "requester-a@toktickit.test" },
      select: { id: true },
    });
    const inactiveRequester = await prisma.developmentRequester.findUnique({
      where: { email: "inactive-requester@toktickit.test" },
      select: { id: true },
    });
    const category = await prisma.category.findUnique({
      where: { name: "Hardware" },
      select: { id: true },
    });
    const relatedSystem = await prisma.relatedSystem.findUnique({
      where: { name: "VPN" },
      select: { id: true },
    });

    if (!requester || !inactiveRequester || !category || !relatedSystem) {
      throw new Error("Expected Lab 2 reference data was not seeded");
    }

    requesterId = requester.id;
    inactiveRequesterId = inactiveRequester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const inactiveCategory = await prisma.category.create({
      data: { name: `Inactive test category ${randomUUID()}`, active: false },
      select: { id: true },
    });
    const inactiveRelatedSystem = await prisma.relatedSystem.create({
      data: {
        name: `Inactive test system ${randomUUID()}`,
        active: false,
      },
      select: { id: true },
    });

    inactiveCategoryId = inactiveCategory.id;
    inactiveRelatedSystemId = inactiveRelatedSystem.id;
  });

  afterAll(async () => {
    const ticketIds = [...createdTicketIds];
    if (ticketIds.length > 0) {
      await prisma.attachment.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    }

    await prisma.category.deleteMany({
      where: { id: inactiveCategoryId },
    });
    await prisma.relatedSystem.deleteMany({
      where: { id: inactiveRelatedSystemId },
    });
    await prisma.$disconnect();
  });

  it("requires an active Development Requester context", async () => {
    const missing = await request(app).post("/api/tickets").send(buildInput());
    expectError(missing, 400, "REQUESTER_CONTEXT_REQUIRED");

    const malformed = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", "not-an-id")
      .send(buildInput());
    expectError(malformed, 400, "REQUESTER_CONTEXT_INVALID");

    const inactive = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(inactiveRequesterId))
      .send(buildInput());
    expectError(inactive, 400, "REQUESTER_CONTEXT_INVALID");
  });

  it("creates one NEW Ticket with a server-generated number and normalized values", async () => {
    const input = buildInput({
      summary: "  VPN connection fails  ",
      description:
        "  The VPN connection fails after entering the credentials.  ",
    });
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(input);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        ticketNumber: expect.stringMatching(ticketNumberPattern),
        ticketDate: expect.any(String),
        requester: { id: requesterId, name: "Requester A" },
        category: { id: categoryId, name: "Hardware" },
        relatedSystem: { id: relatedSystemId, name: "VPN" },
        requestedPriority: "MEDIUM",
        summary: "VPN connection fails",
        description: "The VPN connection fails after entering the credentials.",
        currentStatus: "NEW",
        createdAt: expect.any(String),
        lastUpdated: expect.any(String),
        attachments: [],
      }),
    );
    expect(response.body.requesterId).toBeUndefined();

    createdTicketIds.add(response.body.id);
    const savedTicket = await prisma.ticket.findUnique({
      where: { id: response.body.id },
    });
    expect(savedTicket).toEqual(
      expect.objectContaining({
        requesterId,
        categoryId,
        relatedSystemId,
        currentStatus: "NEW",
        summary: "VPN connection fails",
      }),
    );
  });

  it("rejects invalid body fields and server-owned fields without saving", async () => {
    const invalidInput = buildInput({
      requestedPriority: "URGENT" as TicketInput["requestedPriority"],
      summary: "bad",
      description: "too short",
    });
    const invalidResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(invalidInput);
    expectError(invalidResponse, 400, "TICKET_INPUT_INVALID");
    expect(invalidResponse.body.error.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "requestedPriority" }),
        expect.objectContaining({ field: "summary" }),
        expect.objectContaining({ field: "description" }),
      ]),
    );

    const ownedFieldInput = {
      ...buildInput(),
      ticketNumber: "TT-20260827-ABC123",
      ticketDate: new Date().toISOString(),
      currentStatus: "NEW",
      requesterId,
    };
    const ownedFieldResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(ownedFieldInput);
    expectError(ownedFieldResponse, 400, "TICKET_INPUT_INVALID");

    expect(
      await prisma.ticket.count({
        where: {
          clientRequestId: {
            in: [invalidInput.clientRequestId, ownedFieldInput.clientRequestId],
          },
        },
      }),
    ).toBe(0);
  });

  it("rejects inactive referenced records", async () => {
    const inactiveCategoryResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(buildInput({ categoryId: inactiveCategoryId }));
    expectError(inactiveCategoryResponse, 404, "CATEGORY_NOT_FOUND");

    const inactiveSystemInput = buildInput({
      relatedSystemId: inactiveRelatedSystemId,
    });
    const inactiveSystemResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(inactiveSystemInput);
    expectError(inactiveSystemResponse, 404, "RELATED_SYSTEM_NOT_FOUND");
  });

  it("returns the original Ticket on an equivalent idempotent retry", async () => {
    const input = buildInput();
    const firstResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(input);
    const retryResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send({ ...input, summary: `  ${input.summary}  ` });

    expect(firstResponse.status).toBe(201);
    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.id).toBe(firstResponse.body.id);
    expect(retryResponse.body.ticketNumber).toBe(
      firstResponse.body.ticketNumber,
    );
    createdTicketIds.add(firstResponse.body.id);
    expect(
      await prisma.ticket.count({
        where: { clientRequestId: input.clientRequestId },
      }),
    ).toBe(1);
  });

  it("rejects reuse of an idempotency key with a different payload", async () => {
    const input = buildInput();
    const firstResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send(input);
    const conflictResponse = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterId))
      .send({
        ...input,
        description: "A different description for this ticket.",
      });

    expect(firstResponse.status).toBe(201);
    expectError(conflictResponse, 409, "IDEMPOTENCY_KEY_REUSED");
    createdTicketIds.add(firstResponse.body.id);
    expect(
      await prisma.ticket.count({
        where: { clientRequestId: input.clientRequestId },
      }),
    ).toBe(1);
  });
});
