import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { loginAgent, prepareLab3Data, prisma } from "../lab-03/test-helpers.js";
import {
  cleanDashboardFixtures,
  createDashboardTicket,
  createDashboardUser,
} from "./dashboard-test-helpers.js";

const windowMilliseconds = 30 * 24 * 60 * 60 * 1_000;
let requester!: Awaited<ReturnType<typeof createDashboardUser>>;
let anotherRequester!: Awaited<ReturnType<typeof createDashboardUser>>;
let staff!: Awaited<ReturnType<typeof loginAgent>>;
let administrator!: Awaited<ReturnType<typeof loginAgent>>;
let ticketIds: number[] = [];

async function createTicket(
  options: Parameters<typeof createDashboardTicket>[0],
) {
  const ticket = await createDashboardTicket(options);
  ticketIds.push(ticket.id);
  return ticket;
}

beforeAll(async () => {
  await prepareLab3Data();
  requester = await createDashboardUser("REQUESTER");
  anotherRequester = await createDashboardUser("REQUESTER");
  staff = await loginAgent("it-staff-a@toktickit.test");
  administrator = await loginAgent("administrator@toktickit.test");
  vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1_000));
});

afterEach(async () => {
  await cleanDashboardFixtures({ ticketIds, userIds: [] });
  ticketIds = [];
});

afterAll(async () => {
  await cleanDashboardFixtures({
    ticketIds: [],
    userIds: [requester.userId, anotherRequester.userId],
  });
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("GET /api/requester/dashboard", () => {
  it("returns session-scoped counts and inclusive UTC recent windows", async () => {
    const asOf = new Date();
    const windowStart = new Date(asOf.getTime() - windowMilliseconds);
    const outsideWindow = new Date(windowStart.getTime() - 1);
    const owned = await Promise.all([
      createTicket({
        requesterUserId: requester.userId,
        status: "NEW",
        updatedAt: windowStart,
      }),
      createTicket({
        requesterUserId: requester.userId,
        status: "WAITING_FOR_REQUESTER",
        updatedAt: asOf,
      }),
      createTicket({
        requesterUserId: requester.userId,
        status: "RESOLVED",
        updatedAt: new Date(asOf.getTime() - 1_000),
        resolvedAt: windowStart,
      }),
      createTicket({
        requesterUserId: requester.userId,
        status: "CLOSED",
        updatedAt: new Date(asOf.getTime() - 2_000),
        resolvedAt: asOf,
      }),
      createTicket({
        requesterUserId: requester.userId,
        status: "RESOLVED",
        updatedAt: outsideWindow,
        resolvedAt: outsideWindow,
      }),
      createTicket({
        requesterUserId: requester.userId,
        status: "OPEN",
        updatedAt: new Date(asOf.getTime() + 1),
      }),
      createTicket({
        requesterUserId: anotherRequester.userId,
        status: "OPEN",
        updatedAt: asOf,
      }),
    ]);

    const response = await requester.agent.get("/api/requester/dashboard");

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({
      asOf: asOf.toISOString(),
      metrics: {
        openCount: 3,
        waitingForRequesterCount: 1,
        recentlyResolvedCount: 2,
      },
      recentlyUpdated: expect.arrayContaining(
        owned
          .slice(0, 4)
          .map((ticket) => expect.objectContaining({ id: ticket.id })),
      ),
      recentlyResolved: [
        expect.objectContaining({
          id: owned[3].id,
          resolvedAt: asOf.toISOString(),
        }),
        expect.objectContaining({
          id: owned[2].id,
          resolvedAt: windowStart.toISOString(),
        }),
      ],
    });
    expect(response.body.recentlyUpdated).toHaveLength(4);
    expect(response.body.recentlyResolved).toHaveLength(2);
    expect(
      response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
    ).not.toContain(owned[4].id);
    expect(
      response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
    ).not.toContain(owned[5].id);
    expect(
      response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
    ).not.toContain(owned[6].id);
    expect(JSON.stringify(response.body)).not.toContain("description");
    expect(JSON.stringify(response.body)).not.toContain(
      "Dashboard fixture description",
    );
    expect(JSON.stringify(response.body)).not.toContain(anotherRequester.email);

    const activeList = await requester.agent.get(
      "/api/tickets?statusGroup=ACTIVE&pageSize=20",
    );
    expect(activeList.status).toBe(200);
    expect(activeList.body.totalItems).toBe(3);
    expect(
      activeList.body.items.every((ticket: { currentStatus: string }) =>
        [
          "NEW",
          "OPEN",
          "IN_PROGRESS",
          "WAITING_FOR_REQUESTER",
          "REOPENED",
        ].includes(ticket.currentStatus),
      ),
    ).toBe(true);

    expect((await staff.agent.get("/api/requester/dashboard")).status).toBe(
      403,
    );
    expect(
      (await administrator.agent.get("/api/requester/dashboard")).status,
    ).toBe(403);
  });

  it("caps recently updated tickets at five in stable newest-first order", async () => {
    const asOf = new Date();
    const tickets = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        createTicket({
          requesterUserId: requester.userId,
          status: "IN_PROGRESS",
          updatedAt: new Date(asOf.getTime() - (7 - index) * 1_000),
        }),
      ),
    );

    const response = await requester.agent.get("/api/requester/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.recentlyUpdated).toHaveLength(5);
    expect(
      response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
    ).toEqual(
      tickets
        .slice(2)
        .reverse()
        .map((ticket) => ticket.id),
    );
    expect(response.body.recentlyResolved).toEqual([]);
  });
});
