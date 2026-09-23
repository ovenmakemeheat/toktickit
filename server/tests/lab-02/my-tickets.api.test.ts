import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  lab3TestPassword,
  loginAgent,
  prepareLab3Data,
  prisma,
} from "../lab-03/test-helpers.js";
import { hashPassword } from "../../src/services/password-service.js";

type TicketInput = {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  description: string;
};

const createdTicketIds = new Set<number>();

let requesterA!: Awaited<ReturnType<typeof loginAgent>>;
let requesterB!: Awaited<ReturnType<typeof loginAgent>>;
let emptyRequester!: Awaited<ReturnType<typeof loginAgent>>;
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

async function createTicket(
  authenticated: Awaited<ReturnType<typeof loginAgent>>,
  input: TicketInput,
) {
  const response = await authenticated.agent
    .post("/api/tickets")
    .set("X-CSRF-Token", authenticated.csrfToken)
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
    await prepareLab3Data();
    requesterA = await loginAgent("requester-a@toktickit.test");
    requesterB = await loginAgent("requester-b@toktickit.test");

    const emptyEmail = `empty-${randomUUID()}@toktickit.test`;
    const passwordHash = await hashPassword(lab3TestPassword);
    const emptyUser = await prisma.user.create({
      data: {
        name: "Empty Requester",
        email: emptyEmail,
        role: "REQUESTER",
        passwordHash,
        active: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    emptyRequesterId = emptyUser.id;
    emptyRequester = await loginAgent(emptyEmail);

    const [hardware, software, vpn, email] = await Promise.all([
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

    if (!hardware || !software || !vpn || !email) {
      throw new Error("Expected Lab 3 reference data was not seeded");
    }

    hardwareCategoryId = hardware.id;
    softwareCategoryId = software.id;
    vpnSystemId = vpn.id;
    emailSystemId = email.id;
    marker = `LIST-${randomUUID().slice(0, 8).toUpperCase()}`;

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        createTicket(requesterA, buildInput("A", index)),
      ),
    );
    await createTicket(
      requesterB,
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

    await prisma.user.deleteMany({ where: { id: emptyRequesterId } });
    await prisma.$disconnect();
  });

  it("requires an authenticated Requester and ignores identity headers", async () => {
    const missing = await request(app).get("/api/tickets");
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("SESSION_REQUIRED");

    const malformed = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", "not-an-id");
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe("SESSION_REQUIRED");

    const inactive = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", "999999");
    expect(inactive.status).toBe(401);
    expect(inactive.body.error.code).toBe("SESSION_REQUIRED");
  });

  it("returns only the authenticated Requester's tickets and applies search", async () => {
    const response = await requesterA.agent
      .get("/api/tickets")
      .query({ search: marker.toLowerCase(), pageSize: "20" });

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
        requester: { id: requesterA.userId, name: "Requester A" },
        category: expect.objectContaining({ id: hardwareCategoryId }),
        relatedSystem: expect.objectContaining({ id: vpnSystemId }),
        currentStatus: "NEW",
        lastUpdated: expect.any(String),
      }),
    );
  });

  it("filters, sorts, and paginates deterministically", async () => {
    const filtered = await requesterA.agent.get("/api/tickets").query({
      search: marker,
      categoryId: hardwareCategoryId,
      relatedSystemId: vpnSystemId,
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      sortBy: "summary",
      sortDirection: "asc",
    });

    expectListShape(filtered);
    expect(filtered.body.items.length).toBe(4);
    expect(
      filtered.body.items.map((item: { summary: string }) => item.summary),
    ).toEqual(
      [...filtered.body.items]
        .map((item: { summary: string }) => item.summary)
        .sort((left, right) => left.localeCompare(right)),
    );

    const firstPage = await requesterA.agent
      .get("/api/tickets")
      .query({ search: marker, page: "1", pageSize: "10" });
    const secondPage = await requesterA.agent
      .get("/api/tickets")
      .query({ search: marker, page: "2", pageSize: "10" });

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
    const empty = await emptyRequester.agent.get("/api/tickets");
    const noResults = await requesterA.agent
      .get("/api/tickets")
      .query({ search: "does-not-match-any-ticket" });

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
    const response = await requesterA.agent.get("/api/tickets").query(query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TICKET_QUERY_INVALID");
  });
});
