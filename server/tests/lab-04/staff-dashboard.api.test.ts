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
  createDashboardAction,
  createDashboardTicket,
  createDashboardUser,
} from "./dashboard-test-helpers.js";

const windowMilliseconds = 30 * 24 * 60 * 60 * 1_000;
let staff!: Awaited<ReturnType<typeof createDashboardUser>>;
let requester!: Awaited<ReturnType<typeof loginAgent>>;
let otherOwner!: Awaited<ReturnType<typeof loginAgent>>;
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
  staff = await createDashboardUser("IT_STAFF");
  requester = await loginAgent("requester-a@toktickit.test");
  otherOwner = await loginAgent("it-staff-b@toktickit.test");
  administrator = await loginAgent("administrator@toktickit.test");
  vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1_000));
});

afterEach(async () => {
  await cleanDashboardFixtures({ ticketIds, userIds: [] });
  ticketIds = [];
});

afterAll(async () => {
  await cleanDashboardFixtures({ ticketIds: [], userIds: [staff.userId] });
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("GET /api/staff/dashboard", () => {
  it("returns operational metrics and the authenticated performer's bounded action list", async () => {
    const baseline = await staff.agent.get("/api/staff/dashboard");
    expect(baseline.status).toBe(200);
    const asOf = new Date(baseline.body.asOf as string);
    const activeStatuses = [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "REOPENED",
    ] as const;
    const ticketOptions = [
      { status: "NEW", ownerUserId: null, itPriority: "HIGH" },
      { status: "OPEN", ownerUserId: staff.userId, itPriority: "LOW" },
      {
        status: "IN_PROGRESS",
        ownerUserId: otherOwner.userId,
        itPriority: "MEDIUM",
      },
      {
        status: "WAITING_FOR_REQUESTER",
        ownerUserId: null,
        itPriority: "HIGH",
      },
      {
        status: "REOPENED",
        ownerUserId: otherOwner.userId,
        itPriority: "MEDIUM",
      },
    ] as const;
    const activeTickets = await Promise.all(
      ticketOptions.map((options, index) =>
        createTicket({
          requesterUserId: requester.userId,
          ownerUserId: options.ownerUserId,
          status: options.status,
          itPriority: options.itPriority,
          updatedAt: new Date(asOf.getTime() - (5 - index) * 1_000),
        }),
      ),
    );
    const resolvedTicket = await createTicket({
      requesterUserId: requester.userId,
      ownerUserId: otherOwner.userId,
      status: "RESOLVED",
      updatedAt: asOf,
      resolvedAt: asOf,
    });
    const actions = await Promise.all(
      [...activeTickets, resolvedTicket].map((ticket, index) =>
        createDashboardAction({
          ticketId: ticket.id,
          performedByUserId: staff.userId,
          createdAt:
            index === 5 ? asOf : new Date(asOf.getTime() - (6 - index) * 1_000),
        }),
      ),
    );

    const response = await staff.agent.get("/api/staff/dashboard");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.asOf).toBe(asOf.toISOString());
    expect(response.body.metrics.unassignedActiveCount).toBe(
      baseline.body.metrics.unassignedActiveCount + 2,
    );
    expect(response.body.metrics.myActiveCount).toBe(
      baseline.body.metrics.myActiveCount + 1,
    );
    expect(response.body.metrics.highPriorityActiveCount).toBe(
      baseline.body.metrics.highPriorityActiveCount + 2,
    );
    for (const status of activeStatuses) {
      expect(response.body.metrics.statusBreakdown[status]).toBe(
        baseline.body.metrics.statusBreakdown[status] + 1,
      );
    }
    expect(response.body.metrics.itPriorityBreakdown).toEqual({
      LOW: baseline.body.metrics.itPriorityBreakdown.LOW + 1,
      MEDIUM: baseline.body.metrics.itPriorityBreakdown.MEDIUM + 2,
      HIGH: baseline.body.metrics.itPriorityBreakdown.HIGH + 2,
    });
    expect(response.body.recentlyUpdated).toHaveLength(5);
    expect(
      response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
    ).toEqual(
      activeTickets
        .slice()
        .reverse()
        .map((ticket) => ticket.id),
    );
    expect(response.body.myRecentActions).toHaveLength(5);
    expect(
      response.body.myRecentActions.map((action: { id: number }) => action.id),
    ).toContain(actions[5].id);
    expect(response.body.myRecentActions[0]).toEqual(
      expect.objectContaining({
        id: actions[5].id,
        ticketId: resolvedTicket.id,
        ticketNumber: resolvedTicket.ticketNumber,
        ticketSummary: resolvedTicket.summary,
        performedBy: {
          id: staff.userId,
          name: "Lab 4 IT_STAFF Dashboard User",
          role: "IT_STAFF",
        },
      }),
    );
    expect(
      response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id),
    ).not.toContain(resolvedTicket.id);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("Private follow-up must not appear");
    expect(serialized).not.toContain(
      "Private attachment notes must not appear",
    );
    expect(serialized).not.toContain("Dashboard fixture description");
    expect(response.body.myRecentActions[0]).not.toHaveProperty("followUpNote");
    expect(response.body.myRecentActions[0]).not.toHaveProperty(
      "attachmentNotes",
    );

    const adminResponse = await administrator.agent.get("/api/staff/dashboard");
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.metrics.unassignedActiveCount).toBe(
      response.body.metrics.unassignedActiveCount,
    );
    expect(adminResponse.body.metrics.highPriorityActiveCount).toBe(
      response.body.metrics.highPriorityActiveCount,
    );
    expect(adminResponse.body.metrics.statusBreakdown).toEqual(
      response.body.metrics.statusBreakdown,
    );
    expect(adminResponse.body.metrics.itPriorityBreakdown).toEqual(
      response.body.metrics.itPriorityBreakdown,
    );
    expect(adminResponse.body.recentlyUpdated).toEqual(
      response.body.recentlyUpdated,
    );

    const forbidden = await requester.agent.get("/api/staff/dashboard");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("STAFF_DASHBOARD_FORBIDDEN");
  });

  it("includes the exact 30-day and as-of action boundaries but excludes older actions", async () => {
    const asOf = new Date();
    const windowStart = new Date(asOf.getTime() - windowMilliseconds);
    const dates = [
      new Date(windowStart.getTime() - 1),
      windowStart,
      new Date(asOf.getTime() - 1),
      asOf,
    ];
    const tickets = await Promise.all(
      dates.map((_date) =>
        createTicket({
          requesterUserId: requester.userId,
          ownerUserId: otherOwner.userId,
          status: "CLOSED",
          updatedAt: asOf,
          resolvedAt: asOf,
        }),
      ),
    );
    const actionRows = await Promise.all(
      tickets.map((ticket, index) =>
        createDashboardAction({
          ticketId: ticket.id,
          performedByUserId: staff.userId,
          createdAt: dates[index],
        }),
      ),
    );

    const response = await staff.agent.get("/api/staff/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.myRecentActions).toHaveLength(3);
    expect(
      response.body.myRecentActions.map((action: { id: number }) => action.id),
    ).toEqual([actionRows[3].id, actionRows[2].id, actionRows[1].id]);
  });
});
