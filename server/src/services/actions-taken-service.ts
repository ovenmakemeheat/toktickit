import { createHash } from "node:crypto";
import { Prisma, type PrismaClient, type Role } from "@prisma/client";

import type { AuthenticatedUser } from "./session-service.js";
import { serializableTransactionOptions } from "./transaction-service.js";
import { parseTicketId, TicketNotFoundError } from "./ticket-service.js";

const createFields = new Set([
  "actionAt",
  "actionDescription",
  "result",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
]);
const patchFields = new Set(["expectedVersion", ...createFields]);
const editableFields = new Set([
  "actionAt",
  "actionDescription",
  "result",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const zonedIsoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i;

const actionTakenInclude = {
  performedBy: { select: { id: true, name: true, role: true } },
  updatedBy: { select: { id: true, name: true, role: true } },
} as const satisfies Prisma.ActionTakenInclude;

type ActionTakenWithUsers = Prisma.ActionTakenGetPayload<{
  include: typeof actionTakenInclude;
}>;

type ActionTakenUser = Pick<AuthenticatedUser, "id" | "role">;
type ActionTakenTransaction = Prisma.TransactionClient;
type ActionTakenStore = Pick<
  PrismaClient,
  "ticket" | "actionTaken" | "$transaction"
>;

export type NormalizedActionTakenCreateInput = {
  actionAt: Date;
  actionDescription: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export type NormalizedActionTakenPatchInput = {
  expectedVersion: number;
  actionAt?: Date;
  actionDescription?: string;
  result?: string;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
};

export type ActionTakenResponse = {
  id: number;
  ticketId: number;
  actionAt: string;
  actionDescription: string;
  result: string;
  performedBy: { id: number; name: string; role: Role };
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: number; name: string; role: Role } | null;
  version: number;
};

export type CreateActionTakenResult = {
  actionTaken: ActionTakenResponse;
  replayed: boolean;
};

export class ActionTakenInputValidationError extends Error {
  readonly code = "ACTION_TAKEN_INPUT_INVALID";
  readonly fields: Array<{
    field: string;
    code: "INVALID_VALUE";
    message: string;
  }>;

  constructor(field: string, message: string) {
    super("Action Taken input is invalid");
    this.name = "ActionTakenInputValidationError";
    this.fields = [{ field, code: "INVALID_VALUE", message }];
  }
}

export class ActionTakenIdValidationError extends Error {
  readonly code = "ACTION_TAKEN_ID_INVALID";

  constructor() {
    super("Action Taken ID must be a positive integer");
    this.name = "ActionTakenIdValidationError";
  }
}

export class ActionTakenIdempotencyKeyValidationError extends Error {
  readonly code = "ACTION_TAKEN_IDEMPOTENCY_KEY_INVALID";

  constructor() {
    super("Idempotency-Key must be a UUID");
    this.name = "ActionTakenIdempotencyKeyValidationError";
  }
}

export class ActionTakenNotFoundError extends Error {
  readonly code = "ACTION_TAKEN_NOT_FOUND";

  constructor() {
    super("Action Taken was not found");
    this.name = "ActionTakenNotFoundError";
  }
}

export class IdempotencyKeyReusedError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";

  constructor() {
    super("Idempotency-Key was already used with a different request");
    this.name = "IdempotencyKeyReusedError";
  }
}

export class ActionTakenConflictError extends Error {
  readonly code = "ACTION_TAKEN_CONFLICT";

  constructor() {
    super("The Action Taken changed before this update completed");
    this.name = "ActionTakenConflictError";
  }
}

function readRecord(raw: unknown) {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function rejectUnknownFields(
  body: Record<string, unknown>,
  allowed: Set<string>,
) {
  const unknownField = Object.keys(body).find((field) => !allowed.has(field));
  if (unknownField) {
    throw new ActionTakenInputValidationError(
      unknownField,
      `${unknownField} is not a supported Action Taken field`,
    );
  }
}

function parseActionAt(value: unknown) {
  if (typeof value !== "string" || !zonedIsoDateTimePattern.test(value)) {
    throw new ActionTakenInputValidationError(
      "actionAt",
      "actionAt must be an ISO 8601 date/time with an explicit timezone",
    );
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    zonedIsoDateTimePattern.exec(value) ?? [];
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const actionAt = new Date(value);
  if (
    !Number.isFinite(actionAt.getTime()) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new ActionTakenInputValidationError(
      "actionAt",
      "actionAt must be a valid date/time",
    );
  }
  return actionAt;
}

function parseRequiredText(field: string, value: unknown) {
  if (typeof value !== "string") {
    throw new ActionTakenInputValidationError(field, `${field} is required`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ActionTakenInputValidationError(
      field,
      `${field} must not be empty`,
    );
  }
  if (trimmed.length > 2_000) {
    throw new ActionTakenInputValidationError(
      field,
      `${field} must contain at most 2,000 characters`,
    );
  }
  return trimmed;
}

function parseOptionalText(field: string, value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ActionTakenInputValidationError(
      field,
      `${field} must be text or null`,
    );
  }

  const trimmed = value.trim();
  if (trimmed.length > 2_000) {
    throw new ActionTakenInputValidationError(
      field,
      `${field} must contain at most 2,000 characters`,
    );
  }
  return trimmed || null;
}

export function normalizeActionTakenCreateInput(
  rawInput: unknown,
): NormalizedActionTakenCreateInput {
  const body = readRecord(rawInput);
  rejectUnknownFields(body, createFields);

  if (typeof body.followUpRequired !== "boolean") {
    throw new ActionTakenInputValidationError(
      "followUpRequired",
      "followUpRequired must be true or false",
    );
  }

  const followUpRequired = body.followUpRequired;
  const followUpNote = followUpRequired
    ? parseRequiredText("followUpNote", body.followUpNote)
    : parseOptionalText("followUpNote", body.followUpNote);
  return {
    actionAt: parseActionAt(body.actionAt),
    actionDescription: parseRequiredText(
      "actionDescription",
      body.actionDescription,
    ),
    result: parseRequiredText("result", body.result),
    followUpRequired,
    followUpNote: followUpRequired ? followUpNote : null,
    attachmentNotes: parseOptionalText("attachmentNotes", body.attachmentNotes),
  };
}

export function normalizeActionTakenPatchInput(
  rawInput: unknown,
): NormalizedActionTakenPatchInput {
  const body = readRecord(rawInput);
  rejectUnknownFields(body, patchFields);

  const expectedVersion = body.expectedVersion;
  if (
    typeof expectedVersion !== "number" ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    throw new ActionTakenInputValidationError(
      "expectedVersion",
      "expectedVersion must be a positive integer",
    );
  }

  const suppliedEditableField = [...editableFields].some(
    (field) => field in body,
  );
  if (!suppliedEditableField) {
    throw new ActionTakenInputValidationError(
      "body",
      "At least one editable Action Taken field is required",
    );
  }

  const normalized: NormalizedActionTakenPatchInput = { expectedVersion };
  if ("actionAt" in body) {
    normalized.actionAt = parseActionAt(body.actionAt);
  }
  if ("actionDescription" in body) {
    normalized.actionDescription = parseRequiredText(
      "actionDescription",
      body.actionDescription,
    );
  }
  if ("result" in body) {
    normalized.result = parseRequiredText("result", body.result);
  }
  if ("followUpRequired" in body) {
    if (typeof body.followUpRequired !== "boolean") {
      throw new ActionTakenInputValidationError(
        "followUpRequired",
        "followUpRequired must be true or false",
      );
    }
    normalized.followUpRequired = body.followUpRequired;
  }
  if ("followUpNote" in body) {
    normalized.followUpNote = parseOptionalText(
      "followUpNote",
      body.followUpNote,
    );
  }
  if ("attachmentNotes" in body) {
    normalized.attachmentNotes = parseOptionalText(
      "attachmentNotes",
      body.attachmentNotes,
    );
  }
  return normalized;
}

export function createActionTakenRequestFingerprint(
  ticketId: number,
  performedByUserId: number,
  input: NormalizedActionTakenCreateInput,
) {
  const canonicalRequest = JSON.stringify({
    ticketId,
    performedByUserId,
    actionAt: input.actionAt.toISOString(),
    actionDescription: input.actionDescription,
    result: input.result,
    followUpRequired: input.followUpRequired,
    followUpNote: input.followUpRequired ? input.followUpNote : null,
    attachmentNotes: input.attachmentNotes,
  });
  return createHash("sha256").update(canonicalRequest, "utf8").digest();
}

export function parseActionTakenId(rawActionId: unknown) {
  const normalized =
    typeof rawActionId === "number" ? String(rawActionId) : rawActionId;
  if (typeof normalized !== "string" || !/^[1-9]\d*$/.test(normalized.trim())) {
    throw new ActionTakenIdValidationError();
  }
  const actionId = Number(normalized);
  if (!Number.isSafeInteger(actionId) || actionId < 1) {
    throw new ActionTakenIdValidationError();
  }
  return actionId;
}

function parseIdempotencyKey(rawKey: unknown) {
  if (typeof rawKey !== "string" || !uuidPattern.test(rawKey)) {
    throw new ActionTakenIdempotencyKeyValidationError();
  }
  return rawKey.toLowerCase();
}

function toActionTakenResponse(
  actionTaken: ActionTakenWithUsers,
): ActionTakenResponse {
  return {
    id: actionTaken.id,
    ticketId: actionTaken.ticketId,
    actionAt: actionTaken.actionAt.toISOString(),
    actionDescription: actionTaken.actionDescription,
    result: actionTaken.result,
    performedBy: actionTaken.performedBy,
    followUpRequired: actionTaken.followUpRequired,
    followUpNote: actionTaken.followUpNote,
    attachmentNotes: actionTaken.attachmentNotes,
    createdAt: actionTaken.createdAt.toISOString(),
    updatedAt: actionTaken.updatedAt.toISOString(),
    updatedBy: actionTaken.updatedBy,
    version: actionTaken.version,
  };
}

async function findReadableTicket(
  prisma: Pick<PrismaClient, "ticket"> | ActionTakenTransaction,
  user: ActionTakenUser,
  ticketId: number,
) {
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

export async function listTicketActionsTaken(
  prisma: Pick<PrismaClient, "ticket" | "actionTaken">,
  user: ActionTakenUser,
  rawTicketId: unknown,
): Promise<ActionTakenResponse[]> {
  const ticketId = parseTicketId(rawTicketId);
  const ticket = await findReadableTicket(prisma, user, ticketId);
  const actions = await prisma.actionTaken.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ actionAt: "asc" }, { id: "asc" }],
    include: actionTakenInclude,
  });
  return actions.map(toActionTakenResponse);
}

function isFingerprintMatch(
  actionTaken: { requestFingerprint: Uint8Array },
  fingerprint: Buffer,
) {
  return Buffer.from(actionTaken.requestFingerprint).equals(fingerprint);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function findExistingIdempotentAction(
  prisma: Pick<PrismaClient, "actionTaken">,
  idempotencyKey: string,
) {
  return prisma.actionTaken.findUnique({
    where: { idempotencyKey },
    include: actionTakenInclude,
  });
}

function replayExistingAction(
  existing: ActionTakenWithUsers,
  ticketId: number,
  fingerprint: Buffer,
): CreateActionTakenResult {
  if (
    existing.ticketId !== ticketId ||
    !isFingerprintMatch(existing, fingerprint)
  ) {
    throw new IdempotencyKeyReusedError();
  }
  return { actionTaken: toActionTakenResponse(existing), replayed: true };
}

export async function createTicketActionTaken(
  prisma: ActionTakenStore,
  user: ActionTakenUser,
  rawTicketId: unknown,
  rawIdempotencyKey: unknown,
  rawInput: unknown,
): Promise<CreateActionTakenResult> {
  const ticketId = parseTicketId(rawTicketId);
  const idempotencyKey = parseIdempotencyKey(rawIdempotencyKey);
  const input = normalizeActionTakenCreateInput(rawInput);
  const fingerprint = createActionTakenRequestFingerprint(
    ticketId,
    user.id,
    input,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (transaction) => {
        await findReadableTicket(transaction, user, ticketId);
        const existing = await transaction.actionTaken.findUnique({
          where: { idempotencyKey },
          include: actionTakenInclude,
        });
        if (existing) {
          return replayExistingAction(existing, ticketId, fingerprint);
        }

        const now = new Date();
        const actionTaken = await transaction.actionTaken.create({
          data: {
            ticketId,
            actionAt: input.actionAt,
            actionDescription: input.actionDescription,
            result: input.result,
            performedByUserId: user.id,
            followUpRequired: input.followUpRequired,
            followUpNote: input.followUpNote,
            attachmentNotes: input.attachmentNotes,
            idempotencyKey,
            requestFingerprint: fingerprint,
            version: 1,
            createdAt: now,
            updatedAt: now,
          },
          include: actionTakenInclude,
        });
        await transaction.ticket.update({
          where: { id: ticketId },
          data: { updatedAt: now },
          select: { id: true },
        });
        return {
          actionTaken: toActionTakenResponse(actionTaken),
          replayed: false,
        };
      }, serializableTransactionOptions);
      return result;
    } catch (error) {
      if (!isUniqueConstraintError(error) && !isSerializationConflict(error)) {
        throw error;
      }

      const existing = await findExistingIdempotentAction(
        prisma,
        idempotencyKey,
      );
      if (existing) {
        return replayExistingAction(existing, ticketId, fingerprint);
      }
      if (attempt === 2 || isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Unable to create Action Taken");
}

function applyPatch(
  current: {
    actionAt: Date;
    actionDescription: string;
    result: string;
    followUpRequired: boolean;
    followUpNote: string | null;
    attachmentNotes: string | null;
  },
  patch: NormalizedActionTakenPatchInput,
) {
  const followUpRequired = patch.followUpRequired ?? current.followUpRequired;
  const followUpNote = followUpRequired
    ? patch.followUpNote === undefined
      ? current.followUpNote
      : patch.followUpNote
    : null;

  if (followUpRequired && !followUpNote?.trim()) {
    throw new ActionTakenInputValidationError(
      "followUpNote",
      "followUpNote is required when followUpRequired is true",
    );
  }

  return {
    actionAt: patch.actionAt ?? current.actionAt,
    actionDescription: patch.actionDescription ?? current.actionDescription,
    result: patch.result ?? current.result,
    followUpRequired,
    followUpNote,
    attachmentNotes:
      patch.attachmentNotes === undefined
        ? current.attachmentNotes
        : patch.attachmentNotes,
  };
}

export async function updateTicketActionTaken(
  prisma: ActionTakenStore,
  user: ActionTakenUser,
  rawTicketId: unknown,
  rawActionId: unknown,
  rawInput: unknown,
): Promise<ActionTakenResponse> {
  const ticketId = parseTicketId(rawTicketId);
  const actionId = parseActionTakenId(rawActionId);
  const patch = normalizeActionTakenPatchInput(rawInput);

  try {
    return await prisma.$transaction(async (transaction) => {
      await findReadableTicket(transaction, user, ticketId);
      const current = await transaction.actionTaken.findFirst({
        where: { id: actionId, ticketId },
        include: actionTakenInclude,
      });
      if (!current) {
        throw new ActionTakenNotFoundError();
      }

      if (current.version !== patch.expectedVersion) {
        throw new ActionTakenConflictError();
      }

      const nextValues = applyPatch(current, patch);
      const now = new Date();
      const update = await transaction.actionTaken.updateMany({
        where: { id: actionId, ticketId, version: patch.expectedVersion },
        data: {
          ...nextValues,
          version: { increment: 1 },
          updatedAt: now,
          updatedByUserId: user.id,
        },
      });
      if (update.count === 0) {
        throw new ActionTakenConflictError();
      }

      await transaction.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: now },
        select: { id: true },
      });
      const updated = await transaction.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
        include: actionTakenInclude,
      });
      return toActionTakenResponse(updated);
    }, serializableTransactionOptions);
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ActionTakenConflictError();
    }
    throw error;
  }
}

export { actionTakenInclude, toActionTakenResponse };
