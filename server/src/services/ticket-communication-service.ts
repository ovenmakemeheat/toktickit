import type { PrismaClient, Role } from "@prisma/client";

import { parseTicketId, TicketNotFoundError } from "./ticket-service.js";
import type { AuthenticatedUser } from "./session-service.js";

type CommunicationStore = Pick<
  PrismaClient,
  "ticket" | "publicComment" | "internalNote"
>;

type CommunicationUser = Pick<AuthenticatedUser, "id" | "role">;

const authorSelect = {
  id: true,
  name: true,
  role: true,
} as const;

export type TicketCommunicationEntry = {
  id: number;
  author: { id: number; name: string; role: Role };
  content: string;
  createdAt: string;
};

export class CommunicationContentValidationError extends Error {
  readonly code = "COMMENT_INPUT_INVALID";
  readonly fields = [
    {
      field: "content",
      code: "INVALID_VALUE",
      message: "content must contain 1-2,000 non-whitespace characters",
    },
  ];

  constructor() {
    super("Comment or note content is invalid");
    this.name = "CommunicationContentValidationError";
  }
}

export class ResolutionIndicationValidationError extends Error {
  readonly code = "RESOLUTION_INDICATION_INVALID";
  readonly fields = [
    {
      field: "appearsResolved",
      code: "INVALID_VALUE",
      message: "appearsResolved must be true",
    },
  ];

  constructor() {
    super("Resolution indication is invalid");
    this.name = "ResolutionIndicationValidationError";
  }
}

function validateCommunicationContent(rawContent: unknown) {
  if (typeof rawContent !== "string") {
    throw new CommunicationContentValidationError();
  }

  const content = rawContent.trim();
  if (content.length < 1 || content.length > 2_000) {
    throw new CommunicationContentValidationError();
  }

  return content;
}

function toEntry(entry: {
  id: number;
  content: string;
  createdAt: Date;
  author: { id: number; name: string; role: Role };
}): TicketCommunicationEntry {
  return {
    id: entry.id,
    author: entry.author,
    content: entry.content,
    createdAt: entry.createdAt.toISOString(),
  };
}

async function findReadableTicket(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
) {
  const ticketId = parseTicketId(rawTicketId);
  const ticket = await prisma.ticket.findFirst({
    where:
      user.role === "REQUESTER"
        ? { id: ticketId, requesterUserId: user.id }
        : { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    throw new TicketNotFoundError();
  }

  return ticket;
}

async function findWritableTicket(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
) {
  return findReadableTicket(prisma, user, rawTicketId);
}

export async function listPublicComments(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
) {
  const ticket = await findReadableTicket(prisma, user, rawTicketId);
  const comments = await prisma.publicComment.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { author: { select: authorSelect } },
  });

  return comments.map(toEntry);
}

export async function createPublicComment(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
  rawBody: unknown,
) {
  const ticket = await findWritableTicket(prisma, user, rawTicketId);
  const body =
    typeof rawBody === "object" && rawBody !== null
      ? (rawBody as Record<string, unknown>)
      : {};
  const content = validateCommunicationContent(body.content);
  const comment = await prisma.publicComment.create({
    data: { ticketId: ticket.id, authorUserId: user.id, content },
    include: { author: { select: authorSelect } },
  });

  return toEntry(comment);
}

export async function listInternalNotes(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
) {
  const ticket = await findReadableTicket(prisma, user, rawTicketId);
  const notes = await prisma.internalNote.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { author: { select: authorSelect } },
  });

  return notes.map(toEntry);
}

export async function createInternalNote(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
  rawBody: unknown,
) {
  const ticket = await findReadableTicket(prisma, user, rawTicketId);
  const body =
    typeof rawBody === "object" && rawBody !== null
      ? (rawBody as Record<string, unknown>)
      : {};
  const content = validateCommunicationContent(body.content);
  const note = await prisma.internalNote.create({
    data: { ticketId: ticket.id, authorUserId: user.id, content },
    include: { author: { select: authorSelect } },
  });

  return toEntry(note);
}

export async function indicateRequesterResolution(
  prisma: CommunicationStore,
  user: CommunicationUser,
  rawTicketId: unknown,
  rawBody: unknown,
) {
  const body =
    typeof rawBody === "object" && rawBody !== null
      ? (rawBody as Record<string, unknown>)
      : {};
  if (body.appearsResolved !== true) {
    throw new ResolutionIndicationValidationError();
  }

  const ticket = await findWritableTicket(prisma, user, rawTicketId);
  const current = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { requesterResolutionIndicatedAt: true },
  });
  if (!current) {
    throw new TicketNotFoundError();
  }

  const indication = current.requesterResolutionIndicatedAt ?? new Date();
  if (!current.requesterResolutionIndicatedAt) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { requesterResolutionIndicatedAt: indication },
    });
  }

  return {
    ticketId: ticket.id,
    requesterResolutionIndicatedAt: indication.toISOString(),
  };
}

export { validateCommunicationContent };
