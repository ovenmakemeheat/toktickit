import type {
  Prisma,
  PrismaClient,
  RequestedPriority,
  TicketStatus,
} from "@prisma/client";

import { requireActiveRequester } from "./requester-context-service.js";

const supportedQueryKeys = new Set([
  "search",
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "currentStatus",
  "sortBy",
  "sortDirection",
  "page",
  "pageSize",
]);

const sortFields = [
  "ticketDate",
  "updatedAt",
  "ticketNumber",
  "summary",
] as const;

const pageSizes = [10, 20, 50] as const;

type SortField = (typeof sortFields)[number];
type SortDirection = "asc" | "desc";

export type TicketQuery = {
  search: string;
  categoryId: number | undefined;
  relatedSystemId: number | undefined;
  requestedPriority: RequestedPriority | undefined;
  currentStatus: TicketStatus | undefined;
  sortBy: SortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: (typeof pageSizes)[number];
};

export type TicketQueryFieldError = {
  field: string;
  code: "INVALID_VALUE";
  message: string;
};

export class TicketQueryValidationError extends Error {
  readonly code = "TICKET_QUERY_INVALID";
  readonly fields: TicketQueryFieldError[];

  constructor(fields: TicketQueryFieldError[]) {
    super("One or more ticket query parameters are invalid");
    this.name = "TicketQueryValidationError";
    this.fields = fields;
  }
}

function invalidQuery(fields: TicketQueryFieldError[]): never {
  throw new TicketQueryValidationError(fields);
}

function fieldError(field: string, message: string): TicketQueryFieldError {
  return { field, code: "INVALID_VALUE", message };
}

function readQueryRecord(rawQuery: unknown) {
  if (typeof rawQuery !== "object" || rawQuery === null) {
    return {};
  }

  return rawQuery as Record<string, unknown>;
}

function readSingleValue(
  query: Record<string, unknown>,
  field: string,
): string | undefined {
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

export function parseTicketQuery(rawQuery: unknown): TicketQuery {
  const query = readQueryRecord(rawQuery);
  const unknownKey = Object.keys(query).find(
    (key) => !supportedQueryKeys.has(key),
  );

  if (unknownKey) {
    invalidQuery([fieldError(unknownKey, `${unknownKey} is not supported`)]);
  }

  const rawSearch = readQueryRecord(rawQuery).search;
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
    ["LOW", "MEDIUM", "HIGH"] as const,
  );
  const currentStatus = parseEnum(
    "currentStatus",
    readSingleValue(query, "currentStatus"),
    ["NEW"] as const,
  );
  const sortBy =
    parseEnum("sortBy", readSingleValue(query, "sortBy"), sortFields) ??
    "ticketDate";
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
    currentStatus,
    sortBy,
    sortDirection,
    page,
    pageSize: parsedPageSize as (typeof pageSizes)[number],
  };
}

const ticketSummarySelect = {
  id: true,
  ticketNumber: true,
  ticketDate: true,
  requester: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requestedPriority: true,
  summary: true,
  currentStatus: true,
  updatedAt: true,
} as const satisfies Prisma.TicketSelect;

type TicketWithSummary = Prisma.TicketGetPayload<{
  select: typeof ticketSummarySelect;
}>;

export type TicketSummaryResponse = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: RequestedPriority;
  summary: string;
  currentStatus: TicketStatus;
  lastUpdated: string;
};

export type TicketListResponse = {
  items: TicketSummaryResponse[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type TicketListStore = Pick<PrismaClient, "developmentRequester" | "ticket">;

function buildOrderBy(
  query: TicketQuery,
): Prisma.TicketOrderByWithRelationInput[] {
  switch (query.sortBy) {
    case "updatedAt":
      return [{ updatedAt: query.sortDirection }, { id: "desc" }];
    case "ticketNumber":
      return [{ ticketNumber: query.sortDirection }, { id: "desc" }];
    case "summary":
      return [{ summary: query.sortDirection }, { id: "desc" }];
    default:
      return [{ ticketDate: query.sortDirection }, { id: "desc" }];
  }
}

function toTicketSummary(ticket: TicketWithSummary): TicketSummaryResponse {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate.toISOString(),
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    summary: ticket.summary,
    currentStatus: ticket.currentStatus,
    lastUpdated: ticket.updatedAt.toISOString(),
  };
}

export async function listTickets(
  prisma: TicketListStore,
  requesterHeader: string | undefined,
  rawQuery: unknown,
): Promise<TicketListResponse> {
  const requester = await requireActiveRequester(prisma, requesterHeader);
  const query = parseTicketQuery(rawQuery);
  const where: Prisma.TicketWhereInput = {
    requesterId: requester.id,
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
    ...(query.currentStatus === undefined
      ? {}
      : { currentStatus: query.currentStatus }),
  };

  const [totalItems, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      select: ticketSummarySelect,
      orderBy: buildOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: tickets.map(toTicketSummary),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
  };
}
