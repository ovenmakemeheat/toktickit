import {
  Prisma,
  TicketStatus,
  type PrismaClient,
  type RequestedPriority,
} from "@prisma/client";

import { requireActiveRequester } from "./requester-context-service.js";
import { generateTicketNumber } from "./ticket-number-service.js";
import {
  type CreateTicketInput,
  validateCreateTicketInput,
} from "./ticket-validation-service.js";

type TicketStore = Pick<
  PrismaClient,
  "developmentRequester" | "category" | "relatedSystem" | "ticket"
>;

export const ticketDetailInclude = {
  requester: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.TicketInclude;

type TicketWithDetails = Prisma.TicketGetPayload<{
  include: typeof ticketDetailInclude;
}>;

export type TicketDetailResponse = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: RequestedPriority;
  summary: string;
  description: string;
  currentStatus: TicketStatus;
  createdAt: string;
  lastUpdated: string;
  attachments: Array<{
    id: number;
    displayName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    removedAt: string | null;
    removalReason: string | null;
    isActive: boolean;
    downloadUrl: string | null;
  }>;
};

export class CategoryNotFoundError extends Error {
  readonly code = "CATEGORY_NOT_FOUND";

  constructor() {
    super("Category was not found or is inactive");
    this.name = "CategoryNotFoundError";
  }
}

export class RelatedSystemNotFoundError extends Error {
  readonly code = "RELATED_SYSTEM_NOT_FOUND";

  constructor() {
    super("Related System was not found or is inactive");
    this.name = "RelatedSystemNotFoundError";
  }
}

export class IdempotencyKeyReusedError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";

  constructor() {
    super("clientRequestId has already been used with a different request");
    this.name = "IdempotencyKeyReusedError";
  }
}

export class TicketIdValidationError extends Error {
  readonly code = "TICKET_ID_INVALID";

  constructor() {
    super("Ticket ID must be a positive integer");
    this.name = "TicketIdValidationError";
  }
}

export class TicketNotFoundError extends Error {
  readonly code = "TICKET_NOT_FOUND";

  constructor() {
    super("Ticket was not found");
    this.name = "TicketNotFoundError";
  }
}

export type CreateTicketResult = {
  ticket: TicketDetailResponse;
  replayed: boolean;
};

export function toTicketDetail(
  ticket: TicketWithDetails,
): TicketDetailResponse {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate.toISOString(),
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    summary: ticket.summary,
    description: ticket.description,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt.toISOString(),
    lastUpdated: ticket.updatedAt.toISOString(),
    attachments: ticket.attachments.map((attachment) => {
      const isActive = attachment.removedAt === null;
      return {
        id: attachment.id,
        displayName: attachment.displayName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedAt: attachment.uploadedAt.toISOString(),
        removedAt: attachment.removedAt?.toISOString() ?? null,
        removalReason: attachment.removalReason,
        isActive,
        downloadUrl: isActive
          ? `/api/tickets/${ticket.id}/attachments/${attachment.id}/download`
          : null,
      };
    }),
  };
}

export function parseTicketId(rawTicketId: unknown) {
  if (
    typeof rawTicketId !== "string" ||
    !/^[1-9]\d*$/.test(rawTicketId.trim())
  ) {
    throw new TicketIdValidationError();
  }

  const ticketId = Number(rawTicketId);
  if (!Number.isSafeInteger(ticketId) || ticketId < 1) {
    throw new TicketIdValidationError();
  }

  return ticketId;
}

export async function getTicketDetail(
  prisma: TicketStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
): Promise<TicketDetailResponse> {
  const requester = await requireActiveRequester(prisma, requesterHeader);
  const ticketId = parseTicketId(rawTicketId);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, requesterId: requester.id },
    include: ticketDetailInclude,
  });

  if (!ticket) {
    throw new TicketNotFoundError();
  }

  return toTicketDetail(ticket);
}

function hasEquivalentRequest(
  ticket: TicketWithDetails,
  requesterId: number,
  input: CreateTicketInput,
) {
  return (
    ticket.requesterId === requesterId &&
    ticket.categoryId === input.categoryId &&
    ticket.relatedSystemId === input.relatedSystemId &&
    ticket.requestedPriority === input.requestedPriority &&
    ticket.summary === input.summary &&
    ticket.description === input.description
  );
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findExistingTicket(
  prisma: TicketStore,
  clientRequestId: string,
) {
  return prisma.ticket.findUnique({
    where: { clientRequestId },
    include: ticketDetailInclude,
  });
}

export async function createTicket(
  prisma: TicketStore,
  requesterHeader: string | undefined,
  rawInput: unknown,
  ticketDate = new Date(),
): Promise<CreateTicketResult> {
  const requester = await requireActiveRequester(prisma, requesterHeader);
  const input = validateCreateTicketInput(rawInput);
  const existingTicket = await findExistingTicket(
    prisma,
    input.clientRequestId,
  );

  if (existingTicket) {
    if (!hasEquivalentRequest(existingTicket, requester.id, input)) {
      throw new IdempotencyKeyReusedError();
    }

    return { ticket: toTicketDetail(existingTicket), replayed: true };
  }

  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirst({
      where: { id: input.categoryId, active: true },
      select: { id: true },
    }),
    prisma.relatedSystem.findFirst({
      where: { id: input.relatedSystemId, active: true },
      select: { id: true },
    }),
  ]);

  if (!category) {
    throw new CategoryNotFoundError();
  }

  if (!relatedSystem) {
    throw new RelatedSystemNotFoundError();
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: generateTicketNumber(ticketDate),
          clientRequestId: input.clientRequestId,
          ticketDate,
          requesterId: requester.id,
          categoryId: input.categoryId,
          relatedSystemId: input.relatedSystemId,
          requestedPriority: input.requestedPriority,
          summary: input.summary,
          description: input.description,
          currentStatus: TicketStatus.NEW,
        },
        include: ticketDetailInclude,
      });

      return { ticket: toTicketDetail(ticket), replayed: false };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const ticketForRequest = await findExistingTicket(
        prisma,
        input.clientRequestId,
      );
      if (ticketForRequest) {
        if (!hasEquivalentRequest(ticketForRequest, requester.id, input)) {
          throw new IdempotencyKeyReusedError();
        }

        return {
          ticket: toTicketDetail(ticketForRequest),
          replayed: true,
        };
      }
    }
  }

  throw new Error("Unable to generate a unique Ticket Number");
}
