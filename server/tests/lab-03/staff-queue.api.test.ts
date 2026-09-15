import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loginAgent, prepareLab3Data, prisma } from "./test-helpers.js";

let staff!: Awaited<ReturnType<typeof loginAgent>>;
let requester!: Awaited<ReturnType<typeof loginAgent>>;

beforeAll(async () => {
  await prepareLab3Data();
  staff = await loginAgent("it-staff-a@toktickit.test");
  requester = await loginAgent("requester-a@toktickit.test");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/staff/tickets", () => {
  it("returns the shared queue with operational fields and deterministic pagination", async () => {
    const response = await staff.agent.get("/api/staff/tickets");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
        items: expect.any(Array),
      }),
    );
    expect(response.body.totalItems).toBeGreaterThanOrEqual(8);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        ticketNumber: expect.stringMatching(/^TT-/),
        requester: expect.objectContaining({ id: expect.any(Number) }),
        requestedPriority: expect.any(String),
        itPriority: expect.any(String),
        currentStatus: expect.any(String),
        owner: expect.anything(),
        lastUpdated: expect.any(String),
      }),
    );
  });

  it("applies search, priority, status, ownership, sorting, and page size filters", async () => {
    const unassigned = await staff.agent.get(
      "/api/staff/tickets?owner=unassigned&pageSize=20&sortBy=ticketNumber&sortDirection=asc",
    );
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.items).toHaveLength(1);
    expect(unassigned.body.items[0].owner).toBeNull();

    const searched = await staff.agent.get(
      "/api/staff/tickets?search=VPN&itPriority=HIGH&currentStatus=OPEN",
    );
    expect(searched.status).toBe(200);
    expect(searched.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ summary: "VPN connection fails" }),
      ]),
    );

    const staffUser = await prisma.user.findUniqueOrThrow({
      where: { email: "it-staff-a@toktickit.test" },
      select: { id: true },
    });
    const owned = await staff.agent.get(
      `/api/staff/tickets?owner=${staffUser.id}&pageSize=20`,
    );
    expect(owned.status).toBe(200);
    expect(owned.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: expect.objectContaining({ id: staffUser.id }),
        }),
      ]),
    );
  });

  it("returns documented invalid-query and forbidden errors", async () => {
    const invalid = await staff.agent.get(
      "/api/staff/tickets?sortBy=summary&pageSize=15",
    );
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toEqual(
      expect.objectContaining({ code: "STAFF_QUEUE_QUERY_INVALID" }),
    );
    expect(invalid.body.error.fields).toEqual([
      expect.objectContaining({ field: "sortBy" }),
    ]);

    const invalidPageSize = await staff.agent.get(
      "/api/staff/tickets?pageSize=15",
    );
    expect(invalidPageSize.status).toBe(400);
    expect(invalidPageSize.body.error.fields).toEqual([
      expect.objectContaining({ field: "pageSize" }),
    ]);

    const invalidOwner = await staff.agent.get(
      "/api/staff/tickets?owner=999999999",
    );
    expect(invalidOwner.status).toBe(400);
    expect(invalidOwner.body.error.code).toBe("STAFF_QUEUE_QUERY_INVALID");

    const forbidden = await requester.agent.get("/api/staff/tickets");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("STAFF_QUEUE_FORBIDDEN");
  });
});
