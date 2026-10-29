import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prepareLab3Data, prisma } from "../lab-03/test-helpers.js";
import {
  cleanDashboardFixtures,
  createDashboardAction,
  createDashboardTicket,
  createDashboardUser,
} from "./dashboard-test-helpers.js";

const activeStatuses = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
] as const;
let requester!: Awaited<ReturnType<typeof createDashboardUser>>;
let staff!: Awaited<ReturnType<typeof createDashboardUser>>;
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
  staff = await createDashboardUser("IT_STAFF");
});

afterEach(async () => {
  await cleanDashboardFixtures({ ticketIds, userIds: [] });
  ticketIds = [];
});

afterAll(async () => {
  await cleanDashboardFixtures({
    ticketIds: [],
    userIds: [requester.userId, staff.userId],
  });
  await prisma.$disconnect();
});

describe("PERF-01 dashboard response smoke", () => {
  it("records populated API timings and keeps both dashboard DTOs bounded", async () => {
    const asOf = new Date();
    const tickets = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        createTicket({
          requesterUserId: requester.userId,
          ownerUserId: index % 3 === 0 ? staff.userId : null,
          status:
            index % 7 === 0
              ? "RESOLVED"
              : activeStatuses[index % activeStatuses.length],
          itPriority: index % 2 === 0 ? "HIGH" : "MEDIUM",
          updatedAt: new Date(asOf.getTime() - index * 1_000),
          resolvedAt:
            index % 7 === 0 ? new Date(asOf.getTime() - index * 1_000) : null,
        }),
      ),
    );
    await Promise.all(
      tickets.slice(0, 12).map((ticket, index) =>
        createDashboardAction({
          ticketId: ticket.id,
          performedByUserId: staff.userId,
          createdAt: new Date(asOf.getTime() - index * 1_000),
        }),
      ),
    );

    const staffStart = performance.now();
    const staffResponse = await staff.agent.get("/api/staff/dashboard");
    const staffDurationMs = performance.now() - staffStart;
    const staffBytes = Buffer.byteLength(JSON.stringify(staffResponse.body));

    const requesterStart = performance.now();
    const requesterResponse = await requester.agent.get(
      "/api/requester/dashboard",
    );
    const requesterDurationMs = performance.now() - requesterStart;
    const requesterBytes = Buffer.byteLength(
      JSON.stringify(requesterResponse.body),
    );

    console.info(
      `[PERF-01] local staff=${staffDurationMs.toFixed(1)}ms/${staffBytes}B; ` +
        `requester=${requesterDurationMs.toFixed(1)}ms/${requesterBytes}B; ` +
        "30 fixture Tickets, 12 Actions Taken; no production SLO implied",
    );

    expect(staffResponse.status).toBe(200);
    expect(requesterResponse.status).toBe(200);
    expect(Number.isFinite(staffDurationMs)).toBe(true);
    expect(Number.isFinite(requesterDurationMs)).toBe(true);
    expect(staffBytes).toBeLessThan(100_000);
    expect(requesterBytes).toBeLessThan(100_000);
    expect(staffResponse.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(staffResponse.body.myRecentActions.length).toBeLessThanOrEqual(5);
    expect(requesterResponse.body.recentlyUpdated.length).toBeLessThanOrEqual(
      5,
    );
    expect(requesterResponse.body.recentlyResolved.length).toBeLessThanOrEqual(
      5,
    );
    expect(staffResponse.body.metrics.statusBreakdown).toEqual(
      expect.objectContaining({
        NEW: expect.any(Number),
        OPEN: expect.any(Number),
        IN_PROGRESS: expect.any(Number),
        WAITING_FOR_REQUESTER: expect.any(Number),
        REOPENED: expect.any(Number),
      }),
    );
    expect(requesterResponse.body.metrics.openCount).toBeGreaterThan(0);
    for (const ticket of [
      ...staffResponse.body.recentlyUpdated,
      ...requesterResponse.body.recentlyUpdated,
      ...requesterResponse.body.recentlyResolved,
    ]) {
      expect(ticket).not.toHaveProperty("description");
      expect(ticket).not.toHaveProperty("attachments");
      expect(ticket).not.toHaveProperty("internalNotes");
    }
    for (const action of staffResponse.body.myRecentActions) {
      expect(action).not.toHaveProperty("followUpNote");
      expect(action).not.toHaveProperty("attachmentNotes");
    }
  });
});
