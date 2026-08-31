import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedReferenceData } from "../../prisma/seed-reference-data.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";

type TicketInput = {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  description: string;
};

const createdTicketIds = new Set<number>();

let requesterAId!: number;
let requesterBId!: number;
let inactiveRequesterId!: number;
let emptyRequesterId!: number;
let hardwareCategoryId!: number;
let softwareCategoryId!: number;
let vpnSystemId!: number;
let emailSystemId!: number;
let marker!: string;

function buildInput(
  requesterNumber: "A" | "B",
  index: number,
  overrides: Partial<TicketInput> = {},
): TicketInput {
  return {
    clientRequestId: randomUUID(),
    categoryId: hardwareCategoryId,
    relatedSystemId: vpnSystemId,
    requestedPriority: index % 3 === 0 ? "HIGH" : "MEDIUM",
    summary: `${marker} ${requesterNumber} ticket ${String(index).padStart(2, "0")}`,
    description: `Description for ${marker} ${requesterNumber} ticket ${index}.`,
    ...overrides,
  };
}

async function createTicket(requesterId: number, input: TicketInput) {
  const response = await request(app)
    .post("/api/tickets")
    .set("X-Development-Requester-Id", String(requesterId))
    .send(input);

  expect(response.status).toBe(201);
  expect(response.body.id).toEqual(expect.any(Number));
  createdTicketIds.add(response.body.id);
  return response.body as { id: number };
}

function expectListShape(response: request.Response) {
  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.objectContaining({
      items: expect.any(Array),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
    }),
  );
}

describe("GET /api/tickets", () => {
  beforeAll(async () => {
    await seedReferenceData(prisma);

    const [
      requesterA,
      requesterB,
      inactiveRequester,
      hardware,
      software,
      vpn,
      email,
    ] = await Promise.all([
      prisma.developmentRequester.findUnique({
        where: { email: "requester-a@toktickit.test" },
        select: { id: true },
      }),
      prisma.developmentRequester.findUnique({
        where: { email: "requester-b@toktickit.test" },
        select: { id: true },
      }),
      prisma.developmentRequester.findUnique({
        where: { email: "inactive-requester@toktickit.test" },
        select: { id: true },
      }),
      prisma.category.findUnique({
        where: { name: "Hardware" },
        select: { id: true },
      }),
      prisma.category.findUnique({
        where: { name: "Software" },
        select: { id: true },
      }),
      prisma.relatedSystem.findUnique({
        where: { name: "VPN" },
        select: { id: true },
      }),
      prisma.relatedSystem.findUnique({
        where: { name: "Email" },
        select: { id: true },
      }),
    ]);

    if (
      !requesterA ||
      !requesterB ||
      !inactiveRequester ||
      !hardware ||
      !software ||
      !vpn ||
      !email
    ) {
      throw new Error("Expected Lab 2 reference data was not seeded");
    }

    requesterAId = requesterA.id;
    requesterBId = requesterB.id;
    inactiveRequesterId = inactiveRequester.id;
    hardwareCategoryId = hardware.id;
    softwareCategoryId = software.id;
    vpnSystemId = vpn.id;
    emailSystemId = email.id;
    marker = `LIST-${randomUUID().slice(0, 8).toUpperCase()}`;

    const emptyRequester = await prisma.developmentRequester.create({
      data: {
        name: `Empty list requester ${marker}`,
        email: `empty-${randomUUID()}@toktickit.test`,
        active: true,
      },
      select: { id: true },
    });
    emptyRequesterId = emptyRequester.id;

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        createTicket(requesterAId, buildInput("A", index)),
      ),
    );
    await createTicket(
      requesterBId,
      buildInput("B", 0, {
        categoryId: softwareCategoryId,
        relatedSystemId: emailSystemId,
        requestedPriority: "LOW",
      }),
    );
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

    if (emptyRequesterId) {
      await prisma.developmentRequester.delete({
        where: { id: emptyRequesterId },
      });
    }
    await prisma.$disconnect();
  });

  it("requires an active Development Requester context", async () => {
    const missing = await request(app).get("/api/tickets");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");

    const malformed = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", "not-an-id");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");

    const inactive = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", String(inactiveRequesterId));
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("returns only the selected Requester's tickets and applies case-insensitive search", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ search: marker.toLowerCase(), pageSize: "20" })
      .set("X-Development-Requester-Id", String(requesterAId));

    expectListShape(response);
    expect(response.body.totalItems).toBe(12);
    expect(response.body.items).toHaveLength(12);
    expect(response.body.items).toEqual(
      expect.arrayContaining(
        [...createdTicketIds]
          .slice(0, 12)
          .map((id) => expect.objectContaining({ id })),
      ),
    );
    expect(
      response.body.items.some(
        (item: { requestedPriority: string }) =>
          item.requestedPriority === "LOW",
      ),
    ).toBe(false);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        requester: { id: requesterAId, name: "Requester A" },
        category: expect.objectContaining({ id: hardwareCategoryId }),
        relatedSystem: expect.objectContaining({ id: vpnSystemId }),
        currentStatus: "NEW",
        lastUpdated: expect.any(String),
      }),
    );
  });

  it("filters, sorts, and paginates deterministically", async () => {
    const filtered = await request(app)
      .get("/api/tickets")
      .query({
        search: marker,
        categoryId: hardwareCategoryId,
        relatedSystemId: vpnSystemId,
        requestedPriority: "HIGH",
        currentStatus: "NEW",
        sortBy: "summary",
        sortDirection: "asc",
      })
      .set("X-Development-Requester-Id", String(requesterAId));

    expectListShape(filtered);
    expect(filtered.body.items.length).toBe(4);
    expect(
      filtered.body.items.map((item: { summary: string }) => item.summary),
    ).toEqual(
      [...filtered.body.items]
        .map((item: { summary: string }) => item.summary)
        .sort((left, right) => left.localeCompare(right)),
    );

    const firstPage = await request(app)
      .get("/api/tickets")
      .query({ search: marker, page: "1", pageSize: "10" })
      .set("X-Development-Requester-Id", String(requesterAId));
    const secondPage = await request(app)
      .get("/api/tickets")
      .query({ search: marker, page: "2", pageSize: "10" })
      .set("X-Development-Requester-Id", String(requesterAId));

    expectListShape(firstPage);
    expectListShape(secondPage);
    expect(firstPage.body).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        totalItems: 12,
        totalPages: 2,
      }),
    );
    expect(firstPage.body.items).toHaveLength(10);
    expect(secondPage.body).toEqual(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        totalItems: 12,
        totalPages: 2,
      }),
    );
    expect(secondPage.body.items).toHaveLength(2);
    expect(
      firstPage.body.items.map((item: { id: number }) => item.id),
    ).not.toEqual(
      expect.arrayContaining(
        secondPage.body.items.map((item: { id: number }) => item.id),
      ),
    );
  });

  it("returns a common empty response shape for no owned tickets and no matches", async () => {
    const empty = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", String(emptyRequesterId));
    const noResults = await request(app)
      .get("/api/tickets")
      .query({ search: "does-not-match-any-ticket" })
      .set("X-Development-Requester-Id", String(requesterAId));

    expectListShape(empty);
    expect(empty.body).toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });
    expectListShape(noResults);
    expect(noResults.body).toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it.each([
    [{ search: "x".repeat(121) }, "search length"],
    [{ categoryId: "0" }, "category ID"],
    [{ requestedPriority: "URGENT" }, "priority"],
    [{ sortBy: "createdAt" }, "sort field"],
    [{ page: "0" }, "page"],
    [{ pageSize: "15" }, "page size"],
  ])("rejects invalid %s", async (query, _label) => {
    const response = await request(app)
      .get("/api/tickets")
      .query(query)
      .set("X-Development-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TICKET_QUERY_INVALID");
  });
});
