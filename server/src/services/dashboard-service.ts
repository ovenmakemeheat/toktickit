import type {
  Prisma,
  PrismaClient,
  RequestedPriority,
  TicketStatus,
} from "@prisma/client";

const activeStatuses = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
] as const satisfies readonly TicketStatus[];
const resolvedStatuses = [
  "RESOLVED",
  "CLOSED",
] as const satisfies readonly TicketStatus[];
const priorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const satisfies readonly RequestedPriority[];
const rollingWindowMilliseconds = 30 * 24 * 60 * 60 * 1_000;

type DashboardStore = Pick<PrismaClient, "ticket" | "actionTaken">;
type DashboardOwner = {
  id: number;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
};

type RequesterTicketSummary = {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: TicketStatus;
  requestedPriority: RequestedPriority;
  updatedAt: string;
  resolvedAt: string | null;
};

type StaffTicketSummary = RequesterTicketSummary & {
  itPriority: RequestedPriority;
  owner: DashboardOwner | null;
};

type DashboardPerformer = {
  id: number;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
};

function toDashboardPerformer(user: {
  id: number;
  name: string;
  role: string;
}): DashboardPerformer | null {
  if (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR") {
    return null;
  }
  return { id: user.id, name: user.name, role: user.role };
}

export type RequesterDashboardResponse = {
  asOf: string;
  metrics: {
    openCount: number;
    waitingForRequesterCount: number;
    recentlyResolvedCount: number;
  };
  recentlyUpdated: RequesterTicketSummary[];
  recentlyResolved: RequesterTicketSummary[];
};

export type StaffDashboardResponse = {
  asOf: string;
  metrics: {
    unassignedActiveCount: number;
    myActiveCount: number;
    highPriorityActiveCount: number;
    statusBreakdown: Record<(typeof activeStatuses)[number], number>;
    itPriorityBreakdown: Record<(typeof priorities)[number], number>;
  };
  recentlyUpdated: StaffTicketSummary[];
  myRecentActions: {
    id: number;
    ticketId: number;
    ticketNumber: string;
    ticketSummary: string;
    actionDescription: string;
    result: string;
    createdAt: string;
    performedBy: DashboardPerformer;
  }[];
};

const requesterTicketSummarySelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  requestedPriority: true,
  updatedAt: true,
  resolvedAt: true,
} as const satisfies Prisma.TicketSelect;

const staffTicketSummarySelect = {
  ...requesterTicketSummarySelect,
  itPriority: true,
  primaryOwner: { select: { id: true, name: true, role: true } },
} as const satisfies Prisma.TicketSelect;

type RequesterTicketRecord = Prisma.TicketGetPayload<{
  select: typeof requesterTicketSummarySelect;
}>;
type StaffTicketRecord = Prisma.TicketGetPayload<{
  select: typeof staffTicketSummarySelect;
}>;

type DashboardWindow = { asOf: Date; start: Date };

function dashboardWindow(): DashboardWindow {
  const asOf = new Date();
  return {
    asOf,
    start: new Date(asOf.getTime() - rollingWindowMilliseconds),
  };
}

function toRequesterSummary(
  ticket: RequesterTicketRecord,
): RequesterTicketSummary {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    currentStatus: ticket.currentStatus,
    requestedPriority: ticket.requestedPriority,
    updatedAt: ticket.updatedAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  };
}

function toStaffSummary(ticket: StaffTicketRecord): StaffTicketSummary {
  return {
    ...toRequesterSummary(ticket),
    itPriority: ticket.itPriority,
    owner:
      ticket.primaryOwner &&
      (ticket.primaryOwner.role === "IT_STAFF" ||
        ticket.primaryOwner.role === "ADMINISTRATOR")
        ? {
            id: ticket.primaryOwner.id,
            name: ticket.primaryOwner.name,
            role: ticket.primaryOwner.role,
          }
        : null,
  };
}

export async function getRequesterDashboard(
  prisma: DashboardStore,
  requesterUserId: number,
): Promise<RequesterDashboardResponse> {
  const { asOf, start } = dashboardWindow();
  const requesterScope: Prisma.TicketWhereInput = { requesterUserId };
  const activeScope: Prisma.TicketWhereInput = {
    ...requesterScope,
    currentStatus: { in: [...activeStatuses] },
  };
  const recentWindow = { gte: start, lte: asOf };
  const resolvedScope: Prisma.TicketWhereInput = {
    ...requesterScope,
    currentStatus: { in: [...resolvedStatuses] },
    resolvedAt: recentWindow,
  };

  const [
    openCount,
    waitingForRequesterCount,
    recentlyResolvedCount,
    updated,
    resolved,
  ] = await Promise.all([
    prisma.ticket.count({ where: activeScope }),
    prisma.ticket.count({
      where: {
        ...requesterScope,
        currentStatus: "WAITING_FOR_REQUESTER",
      },
    }),
    prisma.ticket.count({ where: resolvedScope }),
    prisma.ticket.findMany({
      where: { ...requesterScope, updatedAt: recentWindow },
      select: requesterTicketSummarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
    prisma.ticket.findMany({
      where: resolvedScope,
      select: requesterTicketSummarySelect,
      orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);

  return {
    asOf: asOf.toISOString(),
    metrics: { openCount, waitingForRequesterCount, recentlyResolvedCount },
    recentlyUpdated: updated.map(toRequesterSummary),
    recentlyResolved: resolved.map(toRequesterSummary),
  };
}

export async function getStaffDashboard(
  prisma: DashboardStore,
  staffUserId: number,
): Promise<StaffDashboardResponse> {
  const { asOf, start } = dashboardWindow();
  const activeScope: Prisma.TicketWhereInput = {
    currentStatus: { in: [...activeStatuses] },
  };
  const recentWindow = { gte: start, lte: asOf };
  const [
    unassignedActiveCount,
    myActiveCount,
    highPriorityActiveCount,
    statusGroups,
    priorityGroups,
    updated,
    actions,
  ] = await Promise.all([
    prisma.ticket.count({
      where: { ...activeScope, primaryOwnerUserId: null },
    }),
    prisma.ticket.count({
      where: { ...activeScope, primaryOwnerUserId: staffUserId },
    }),
    prisma.ticket.count({
      where: { ...activeScope, itPriority: "HIGH" },
    }),
    prisma.ticket.groupBy({
      by: ["currentStatus"],
      where: activeScope,
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["itPriority"],
      where: activeScope,
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { ...activeScope, updatedAt: recentWindow },
      select: staffTicketSummarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
    prisma.actionTaken.findMany({
      where: { performedByUserId: staffUserId, createdAt: recentWindow },
      select: {
        id: true,
        ticketId: true,
        actionDescription: true,
        result: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, role: true } },
        ticket: { select: { ticketNumber: true, summary: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);

  const statusBreakdown = Object.fromEntries(
    activeStatuses.map((status) => [status, 0]),
  ) as Record<(typeof activeStatuses)[number], number>;
  for (const group of statusGroups) {
    statusBreakdown[group.currentStatus as keyof typeof statusBreakdown] =
      group._count._all;
  }

  const itPriorityBreakdown = Object.fromEntries(
    priorities.map((priority) => [priority, 0]),
  ) as Record<(typeof priorities)[number], number>;
  for (const group of priorityGroups) {
    itPriorityBreakdown[group.itPriority] = group._count._all;
  }

  return {
    asOf: asOf.toISOString(),
    metrics: {
      unassignedActiveCount,
      myActiveCount,
      highPriorityActiveCount,
      statusBreakdown,
      itPriorityBreakdown,
    },
    recentlyUpdated: updated.map(toStaffSummary),
    myRecentActions: actions.flatMap((action) => {
      const performedBy = toDashboardPerformer(action.performedBy);
      return performedBy
        ? [
            {
              id: action.id,
              ticketId: action.ticketId,
              ticketNumber: action.ticket.ticketNumber,
              ticketSummary: action.ticket.summary,
              actionDescription: action.actionDescription,
              result: action.result,
              createdAt: action.createdAt.toISOString(),
              performedBy,
            },
          ]
        : [];
    }),
  };
}
