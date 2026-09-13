import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  loginAgent,
  prepareLab3Data,
  prisma,
} from "../lab-03/test-helpers.js";
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

let authenticated!: Awaited<ReturnType<typeof loginAgent>>;
let requesterId!: number;
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

function postTicket(input: object) {
  return authenticated.agent
    .post("/api/tickets")
    .set("X-CSRF-Token", authenticated.csrfToken)
    .send(input);
}

describe("POST /api/tickets", () => {
  beforeAll(async () => {
    await prepareLab3Data();
    authenticated = await loginAgent("requester-a@toktickit.test");
    requesterId = authenticated.userId;

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

    await prisma.category.deleteMany({ where: { id: inactiveCategoryId } });
    await prisma.relatedSystem.deleteMany({
      where: { id: inactiveRelatedSystemId },
    });
    await prisma.$disconnect();
  });

  it("requires an authenticated Requester and ignores identity headers", async () => {
    const missing = await request(app).post("/api/tickets").send(buildInput());
    expectError(missing, 401, "SESSION_REQUIRED");

    const malformed = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", "not-an-id")
      .send(buildInput());
    expectError(malformed, 401, "SESSION_REQUIRED");

    const spoofed = await postTicket({
      ...buildInput(),
      requesterId: 999999,
    });
    expectError(spoofed, 400, "TICKET_INPUT_INVALID");
  });

  it("creates one NEW Ticket owned by the authenticated User", async () => {
    const input = buildInput({
      requestedPriority: "HIGH",
      summary: "  VPN connection fails  ",
      description:
        "  The VPN connection fails after entering the credentials.  ",
    });
    const response = await postTicket(input);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        ticketNumber: expect.stringMatching(ticketNumberPattern),
        ticketDate: expect.any(String),
        requester: { id: requesterId, name: "Requester A" },
        category: { id: categoryId, name: "Hardware" },
        relatedSystem: { id: relatedSystemId, name: "VPN" },
        requestedPriority: "HIGH",
        summary: "VPN connection fails",
        description: "The VPN connection fails after entering the credentials.",
        currentStatus: "NEW",
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
        requesterId: null,
        requesterUserId: requesterId,
        categoryId,
        relatedSystemId,
        requestedPriority: "HIGH",
        itPriority: "HIGH",
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
    const invalidResponse = await postTicket(invalidInput);
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
    const ownedFieldResponse = await postTicket(ownedFieldInput);
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
    const inactiveCategoryResponse = await postTicket(
      buildInput({ categoryId: inactiveCategoryId }),
    );
    expectError(inactiveCategoryResponse, 404, "CATEGORY_NOT_FOUND");

    const inactiveSystemResponse = await postTicket(
      buildInput({ relatedSystemId: inactiveRelatedSystemId }),
    );
    expectError(inactiveSystemResponse, 404, "RELATED_SYSTEM_NOT_FOUND");
  });

  it("returns the original Ticket on an equivalent idempotent retry", async () => {
    const input = buildInput();
    const firstResponse = await postTicket(input);
    const retryResponse = await postTicket({
      ...input,
      summary: `  ${input.summary}  `,
    });

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
    const firstResponse = await postTicket(input);
    const conflictResponse = await postTicket({
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
