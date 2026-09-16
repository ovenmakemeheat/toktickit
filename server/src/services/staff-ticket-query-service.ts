import type {
  Prisma,
  PrismaClient,
  RequestedPriority,
  TicketStatus,
} from "@prisma/client";

import {
  listEligibleStaffOwners,
  type StaffOwnerResponse,
} from "./staff-owner-service.js";
import { TicketNotFoundError } from "./ticket-service.js";

const supportedQueryKeys = new Set([
  "search",
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "itPriority",
  "currentStatus",
  "owner",
  "sortBy",
  "sortDirection",
  "page",
  "pageSize",
]);

const sortFields = [
  "ticketDate",
  "updatedAt",
  "ticketNumber",
  "itPriority",
  "currentStatus",
  "owner",
] as const;

const pageSizes = [10, 20, 50] as const;
const statusValues = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const satisfies readonly TicketStatus[];
const priorityValues = ["LOW", "MEDIUM", "HIGH"] as const;

type SortField = (typeof sortFields)[number];
type SortDirection = "asc" | "desc";
export type StaffOwnerFilter = "unassigned" | "me" | number;

type QueryRecord = Record<string, unknown>;

export type StaffTicketQuery = {
  search: string;
  categoryId: number | undefined;
  relatedSystemId: number | undefined;
  requestedPriority: RequestedPriority | undefined;
  itPriority: RequestedPriority | undefined;
  currentStatus: TicketStatus | undefined;
  owner: StaffOwnerFilter | undefined;
  sortBy: SortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: (typeof pageSizes)[number];
};

export type StaffQueueQueryFieldError = {
  field: string;
  code: "INVALID_VALUE";
  message: string;
};

export class StaffQueueQueryValidationError extends Error {
  readonly code = "STAFF_QUEUE_QUERY_INVALID";
  readonly fields: StaffQueueQueryFieldError[];

  constructor(fields: StaffQueueQueryFieldError[]) {
    super("One or more Staff Ticket Queue query parameters are invalid");
    this.name = "StaffQueueQueryValidationError";
    this.fields = fields;
  }
}

function invalidQuery(fields: StaffQueueQueryFieldError[]): never {
  throw new StaffQueueQueryValidationError(fields);
}

function fieldError(field: string, message: string) {
  return { field, code: "INVALID_VALUE" as const, message };
}

function readQueryRecord(rawQuery: unknown): QueryRecord {
  if (typeof rawQuery !== "object" || rawQuery === null) {
    return {};
  }
  return rawQuery as QueryRecord;
}

function readSingleValue(query: QueryRecord, field: string) {
  if (!(field in query)) {
    return undefined;
  }

  const value = query[field];
  if (typeof value === "string") {
    return value;
  }

  invalidQuery([
    fieldError(field, `${field} must be provided once as a string`),
  ]);
}

function parsePositiveInteger(field: string, value: string | undefined) {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    invalidQuery([fieldError(field, `${field} must be a positive integer`)]);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    invalidQuery([fieldError(field, `${field} must be a positive integer`)]);
  }

  return parsed;
}

function parseOptionalPositiveInteger(
  field: string,
  value: string | undefined,
) {
  return value === undefined ? undefined : parsePositiveInteger(field, value);
}

function parseEnum<T extends string>(
  field: string,
  value: string | undefined,
  values: readonly T[],
) {
  if (value === undefined) {
    return undefined;
  }
  if (!values.includes(value as T)) {
    invalidQuery([
      fieldError(field, `${field} must be one of ${values.join(", ")}`),
    ]);
  }
  return value as T;
}

function parseOwner(value: string | undefined): StaffOwnerFilter | undefined {
  if (value === undefined || value === "unassigned" || value === "me") {
    return value;
  }

  return parsePositiveInteger("owner", value);
}

export function parseStaffTicketQuery(rawQuery: unknown): StaffTicketQuery {
  const query = readQueryRecord(rawQuery);
  const unknownKey = Object.keys(query).find(
    (key) => !supportedQueryKeys.has(key),
  );
  if (unknownKey) {
    invalidQuery([fieldError(unknownKey, `${unknownKey} is not supported`)]);
  }

  const rawSearch = query.search;
  const search = readSingleValue(query, "search")?.trim() ?? "";
  if (typeof rawSearch === "string" && search.length > 120) {
    invalidQuery([
      fieldError("search", "search must contain at most 120 characters"),
    ]);
  }

  const categoryId = parseOptionalPositiveInteger(
    "categoryId",
    readSingleValue(query, "categoryId"),
  );
  const relatedSystemId = parseOptionalPositiveInteger(
    "relatedSystemId",
    readSingleValue(query, "relatedSystemId"),
  );
  const requestedPriority = parseEnum(
    "requestedPriority",
    readSingleValue(query, "requestedPriority"),
    priorityValues,
  );
  const itPriority = parseEnum(
    "itPriority",
    readSingleValue(query, "itPriority"),
    priorityValues,
  );
  const currentStatus = parseEnum(
    "currentStatus",
    readSingleValue(query, "currentStatus"),
    statusValues,
  );
  const owner = parseOwner(readSingleValue(query, "owner"));
  const sortBy =
    parseEnum("sortBy", readSingleValue(query, "sortBy"), sortFields) ??
    "updatedAt";
  const sortDirection =
    parseEnum("sortDirection", readSingleValue(query, "sortDirection"), [
      "asc",
      "desc",
    ] as const) ?? "desc";
  const page = parsePositiveInteger(
    "page",
    readSingleValue(query, "page") ?? "1",
  );
  const parsedPageSize = parsePositiveInteger(
    "pageSize",
    readSingleValue(query, "pageSize") ?? "10",
  );

  if (!pageSizes.includes(parsedPageSize as (typeof pageSizes)[number])) {
    invalidQuery([fieldError("pageSize", "pageSize must be 10, 20, or 50")]);
  }

  return {
    search,
    categoryId,
    relatedSystemId,
    requestedPriority,
    itPriority,
    currentStatus,
    owner,
    sortBy,
    sortDirection,
    page,
    pageSize: parsedPageSize as (typeof pageSizes)[number],
  };
}

const staffTicketSummarySelect = {
  id: true,
  ticketNumber: true,
  ticketDate: true,
  requesterUser: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requestedPriority: true,
  itPriority: true,
  summary: true,
  currentStatus: true,
  primaryOwner: { select: { id: true, name: true, role: true } },
  updatedAt: true,
} as const satisfies Prisma.TicketSelect;

type StaffTicketWithSummary = Prisma.TicketGetPayload<{
  select: typeof staffTicketSummarySelect;
}>;

export type StaffTicketSummaryResponse = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  summary: string;
  currentStatus: TicketStatus;
  owner: {
    id: number;
    name: string;
    role: "IT_STAFF" | "ADMINISTRATOR";
  } | null;
  lastUpdated: string;
};

export type StaffTicketListResponse = {
  items: StaffTicketSummaryResponse[];
  eligibleOwners: StaffOwnerResponse[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type StaffTicketListStore = Pick<PrismaClient, "ticket" | "user">;

function buildOrderBy(
  query: StaffTicketQuery,
): Prisma.TicketOrderByWithRelationInput[] {
  switch (query.sortBy) {
    case "ticketDate":
      return [{ ticketDate: query.sortDirection }, { id: "desc" }];
    case "ticketNumber":
      return [{ ticketNumber: query.sortDirection }, { id: "desc" }];
    case "itPriority":
      return [{ itPriority: query.sortDirection }, { id: "desc" }];
    case "currentStatus":
      return [{ currentStatus: query.sortDirection }, { id: "desc" }];
    case "owner":
      return [{ primaryOwner: { name: query.sortDirection } }, { id: "desc" }];
    default:
      return [{ updatedAt: query.sortDirection }, { id: "desc" }];
  }
}

function toStaffTicketSummary(
  ticket: StaffTicketWithSummary,
): StaffTicketSummaryResponse {
  const requester = ticket.requesterUser ?? ticket.requester;
  if (!requester) {
    throw new TicketNotFoundError();
  }

  const owner =
    ticket.primaryOwner &&
    (ticket.primaryOwner.role === "IT_STAFF" ||
      ticket.primaryOwner.role === "ADMINISTRATOR")
      ? {
          id: ticket.primaryOwner.id,
          name: ticket.primaryOwner.name,
          role: ticket.primaryOwner.role,
        }
      : null;

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate.toISOString(),
    requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    summary: ticket.summary,
    currentStatus: ticket.currentStatus,
    owner,
    lastUpdated: ticket.updatedAt.toISOString(),
  };
}

function validateOwnerFilter(
  owner: StaffOwnerFilter | undefined,
  eligibleOwners: StaffOwnerResponse[],
) {
  if (
    typeof owner !== "number" ||
    eligibleOwners.some((eligibleOwner) => eligibleOwner.id === owner)
  ) {
    return;
  }

  throw new StaffQueueQueryValidationError([
    fieldError(
      "owner",
      "owner must identify an active IT Staff or Administrator",
    ),
  ]);
}

export async function listStaffTickets(
  prisma: StaffTicketListStore,
  staffUserId: number,
  rawQuery: unknown,
): Promise<StaffTicketListResponse> {
  const query = parseStaffTicketQuery(rawQuery);
  const eligibleOwners = await listEligibleStaffOwners(prisma);
  validateOwnerFilter(query.owner, eligibleOwners);

  const where: Prisma.TicketWhereInput = {
    ...(query.search
      ? {
          OR: [
            {
              ticketNumber: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            { summary: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
    ...(query.relatedSystemId === undefined
      ? {}
      : { relatedSystemId: query.relatedSystemId }),
    ...(query.requestedPriority === undefined
      ? {}
      : { requestedPriority: query.requestedPriority }),
    ...(query.itPriority === undefined ? {} : { itPriority: query.itPriority }),
    ...(query.currentStatus === undefined
      ? {}
      : { currentStatus: query.currentStatus }),
    ...(query.owner === undefined
      ? {}
      : query.owner === "unassigned"
        ? { primaryOwnerUserId: null }
        : {
            primaryOwnerUserId:
              query.owner === "me" ? staffUserId : query.owner,
          }),
  };

  const [totalItems, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      select: staffTicketSummarySelect,
      orderBy: buildOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: tickets.map(toStaffTicketSummary),
    eligibleOwners,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
  };
}

export { buildOrderBy };
