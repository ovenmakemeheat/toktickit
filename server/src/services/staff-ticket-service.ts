import type {
  Prisma,
  PrismaClient,
  RequestedPriority,
  Role,
  TicketStatus,
} from "@prisma/client";

import { listEligibleStaffOwners } from "./staff-owner-service.js";
import {
  assertAllowedStatusTransition,
  parseTicketStatus,
} from "./ticket-status-service.js";
import { parseTicketId, TicketNotFoundError } from "./ticket-service.js";

const staffTicketDetailInclude = {
  requesterUser: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  primaryOwner: { select: { id: true, name: true, role: true } },
  attachments: {
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
  },
  publicComments: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  },
  internalNotes: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  },
} as const satisfies Prisma.TicketInclude;

type StaffTicketWithDetail = Prisma.TicketGetPayload<{
  include: typeof staffTicketDetailInclude;
}>;

type StaffTicketStore = Pick<PrismaClient, "ticket" | "user">;

export type StaffTicketAttachmentResponse = {
  id: number;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  isActive: boolean;
  downloadUrl: null;
};

export type StaffCommunicationResponse = {
  id: number;
  author: { id: number; name: string; role: Role };
  content: string;
  createdAt: string;
};

export type StaffTicketDetailResponse = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  summary: string;
  description: string;
  currentStatus: TicketStatus;
  owner: {
    id: number;
    name: string;
    role: "IT_STAFF" | "ADMINISTRATOR";
  } | null;
  eligibleOwners: Awaited<ReturnType<typeof listEligibleStaffOwners>>;
  requesterResolutionIndicatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: StaffTicketAttachmentResponse[];
  publicComments: StaffCommunicationResponse[];
  internalNotes: StaffCommunicationResponse[];
};

export class TicketAlreadyAssignedError extends Error {
  readonly code = "TICKET_ALREADY_ASSIGNED";

  constructor() {
    super("This Ticket is already assigned to an owner");
    this.name = "TicketAlreadyAssignedError";
  }
}

export class OwnerInvalidError extends Error {
  readonly code = "OWNER_INVALID";

  constructor() {
    super("Owner must be an active IT Staff or Administrator");
    this.name = "OwnerInvalidError";
  }
}

export class ItPriorityValidationError extends Error {
  readonly code = "IT_PRIORITY_INVALID";

  constructor() {
    super("IT Priority must be LOW, MEDIUM, or HIGH");
    this.name = "ItPriorityValidationError";
  }
}

export class TicketStatusConflictError extends Error {
  readonly code = "TICKET_STATUS_CONFLICT";

  constructor() {
    super("The Ticket status changed before this operation completed");
    this.name = "TicketStatusConflictError";
  }
}

function toStaffCommunication(
  entry: StaffTicketWithDetail["publicComments"][number],
): StaffCommunicationResponse {
  return {
    id: entry.id,
    author: entry.author,
    content: entry.content,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toAttachment(
  attachment: StaffTicketWithDetail["attachments"][number],
  _ticketId: number,
): StaffTicketAttachmentResponse {
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
    downloadUrl: null,
  };
}

export function toStaffTicketDetailCore(
  ticket: StaffTicketWithDetail,
): Omit<StaffTicketDetailResponse, "eligibleOwners"> {
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
    description: ticket.description,
    currentStatus: ticket.currentStatus,
    owner,
    requesterResolutionIndicatedAt:
      ticket.requesterResolutionIndicatedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    attachments: ticket.attachments.map((attachment) =>
      toAttachment(attachment, ticket.id),
    ),
    publicComments: ticket.publicComments.map(toStaffCommunication),
    internalNotes: ticket.internalNotes.map(toStaffCommunication),
  };
}

function toStaffTicketDetail(
  ticket: StaffTicketWithDetail,
  eligibleOwners: StaffTicketDetailResponse["eligibleOwners"],
): StaffTicketDetailResponse {
  return { ...toStaffTicketDetailCore(ticket), eligibleOwners };
}

async function findStaffTicket(
  prisma: Pick<PrismaClient, "ticket">,
  rawTicketId: unknown,
) {
  const ticketId = parseTicketId(rawTicketId);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: staffTicketDetailInclude,
  });
  if (!ticket) {
    throw new TicketNotFoundError();
  }
  return ticket;
}

export async function getStaffTicketDetail(
  prisma: Pick<PrismaClient, "ticket" | "user">,
  rawTicketId: unknown,
) {
  const [ticket, eligibleOwners] = await Promise.all([
    findStaffTicket(prisma, rawTicketId),
    listEligibleStaffOwners(prisma),
  ]);
  return toStaffTicketDetail(ticket, eligibleOwners);
}

function readBody(rawBody: unknown) {
  return typeof rawBody === "object" && rawBody !== null
    ? (rawBody as Record<string, unknown>)
    : {};
}

function parseOwnerId(rawBody: unknown) {
  const value = readBody(rawBody).ownerId;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new OwnerInvalidError();
  }
  return value;
}

async function validateOwner(
  prisma: Pick<PrismaClient, "user">,
  ownerId: number,
) {
  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      active: true,
      role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
    },
    select: { id: true },
  });
  if (!owner) {
    throw new OwnerInvalidError();
  }
}

export async function claimStaffTicket(
  prisma: StaffTicketStore,
  staffUserId: number,
  rawTicketId: unknown,
) {
  const ticketId = parseTicketId(rawTicketId);
  const result = await prisma.ticket.updateMany({
    where: { id: ticketId, primaryOwnerUserId: null },
    data: { primaryOwnerUserId: staffUserId },
  });
  if (result.count === 0) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { primaryOwnerUserId: true },
    });
    if (!ticket) {
      throw new TicketNotFoundError();
    }
    throw new TicketAlreadyAssignedError();
  }

  return getStaffTicketDetail(prisma, ticketId);
}

export async function assignStaffTicket(
  prisma: StaffTicketStore,
  rawTicketId: unknown,
  rawBody: unknown,
) {
  const ownerId = parseOwnerId(rawBody);
  const ticket = await findStaffTicket(prisma, rawTicketId);
  await validateOwner(prisma, ownerId);
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { primaryOwnerUserId: ownerId },
  });
  return getStaffTicketDetail(prisma, ticket.id);
}

export function parseItPriority(rawBody: unknown): RequestedPriority {
  const value = readBody(rawBody).itPriority;
  if (value !== "LOW" && value !== "MEDIUM" && value !== "HIGH") {
    throw new ItPriorityValidationError();
  }
  return value;
}

export async function updateStaffTicketPriority(
  prisma: StaffTicketStore,
  rawTicketId: unknown,
  rawBody: unknown,
) {
  const ticket = await findStaffTicket(prisma, rawTicketId);
  const itPriority = parseItPriority(rawBody);
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { itPriority },
  });
  return getStaffTicketDetail(prisma, ticket.id);
}

export async function updateStaffTicketStatus(
  prisma: StaffTicketStore,
  rawTicketId: unknown,
  rawBody: unknown,
) {
  const ticket = await findStaffTicket(prisma, rawTicketId);
  const body = readBody(rawBody);
  const status = parseTicketStatus(body.status);
  assertAllowedStatusTransition(
    ticket.currentStatus,
    status,
    body.confirmation,
  );

  const result = await prisma.ticket.updateMany({
    where: { id: ticket.id, currentStatus: ticket.currentStatus },
    data: { currentStatus: status },
  });
  if (result.count === 0) {
    throw new TicketStatusConflictError();
  }

  return getStaffTicketDetail(prisma, ticket.id);
}

export { staffTicketDetailInclude, toStaffTicketDetail, findStaffTicket };
