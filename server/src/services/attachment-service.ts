import type { PrismaClient } from "@prisma/client";

import {
  maxActiveAttachmentCount,
  sanitizeDisplayName,
  validateAttachmentFile,
  validateRemovalReason,
  type AttachmentUploadFile,
} from "./attachment-policy-service.js";
import {
  generateStorageKey,
  localAttachmentStorage,
  AttachmentStorageUnavailableError,
  type AttachmentStorage,
} from "./attachment-storage-service.js";
import { requireActiveRequester } from "./requester-context-service.js";
import { parseTicketId, TicketNotFoundError } from "./ticket-service.js";

type AttachmentStore = Pick<
  PrismaClient,
  "developmentRequester" | "ticket" | "attachment"
>;

type AttachmentRecord = {
  id: number;
  ticketId: number;
  storageKey: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
};

export type AttachmentMetadataResponse = {
  id: number;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  isActive: boolean;
  downloadUrl: string | null;
};

export type AttachmentUploadFileInput = AttachmentUploadFile & {
  buffer: Buffer;
};

export class AttachmentFileRequiredError extends Error {
  readonly code = "ATTACHMENT_FILE_REQUIRED";

  constructor() {
    super("Attachment file is required");
    this.name = "AttachmentFileRequiredError";
  }
}

export class ActiveAttachmentLimitReachedError extends Error {
  readonly code = "ACTIVE_ATTACHMENT_LIMIT_REACHED";

  constructor() {
    super("The Ticket already has the maximum number of active attachments");
    this.name = "ActiveAttachmentLimitReachedError";
  }
}

export class AttachmentNotFoundError extends Error {
  readonly code = "ATTACHMENT_NOT_FOUND";

  constructor() {
    super("Attachment was not found");
    this.name = "AttachmentNotFoundError";
  }
}

export class AttachmentRemovedError extends Error {
  readonly code = "ATTACHMENT_REMOVED";

  constructor() {
    super("Attachment has been removed");
    this.name = "AttachmentRemovedError";
  }
}

export class AttachmentAlreadyRemovedError extends Error {
  readonly code = "ATTACHMENT_ALREADY_REMOVED";

  constructor() {
    super("Attachment has already been removed");
    this.name = "AttachmentAlreadyRemovedError";
  }
}

export class AttachmentUploadFailedError extends Error {
  readonly code = "ATTACHMENT_UPLOAD_FAILED";

  constructor() {
    super("Attachment upload failed");
    this.name = "AttachmentUploadFailedError";
  }
}

type OwnedTicket = { id: number };

async function requireOwnedTicket(
  prisma: AttachmentStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
): Promise<OwnedTicket> {
  const requester = await requireActiveRequester(prisma, requesterHeader);
  const ticketId = parseTicketId(rawTicketId);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, requesterId: requester.id },
    select: { id: true },
  });

  if (!ticket) {
    throw new TicketNotFoundError();
  }

  return ticket;
}

function parseAttachmentId(rawAttachmentId: unknown) {
  if (
    typeof rawAttachmentId !== "string" ||
    !/^[1-9]\d*$/.test(rawAttachmentId.trim())
  ) {
    throw new AttachmentNotFoundError();
  }

  const attachmentId = Number(rawAttachmentId);
  if (!Number.isSafeInteger(attachmentId) || attachmentId < 1) {
    throw new AttachmentNotFoundError();
  }

  return attachmentId;
}

function toAttachmentMetadata(
  attachment: AttachmentRecord,
  ticketId: number,
): AttachmentMetadataResponse {
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
      ? `/api/tickets/${ticketId}/attachments/${attachment.id}/download`
      : null,
  };
}

function orderAttachments(attachments: AttachmentRecord[]) {
  return [...attachments].sort((left, right) => {
    const leftActive = left.removedAt === null;
    const rightActive = right.removedAt === null;
    if (leftActive !== rightActive) {
      return leftActive ? -1 : 1;
    }

    const uploadedDifference =
      left.uploadedAt.getTime() - right.uploadedAt.getTime();
    return uploadedDifference || left.id - right.id;
  });
}

export async function listTicketAttachments(
  prisma: AttachmentStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
): Promise<AttachmentMetadataResponse[]> {
  const ticket = await requireOwnedTicket(prisma, requesterHeader, rawTicketId);
  const attachments = await prisma.attachment.findMany({
    where: { ticketId: ticket.id },
  });

  return orderAttachments(attachments).map((attachment) =>
    toAttachmentMetadata(attachment, ticket.id),
  );
}

export async function uploadTicketAttachment(
  prisma: AttachmentStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
  file: AttachmentUploadFileInput | undefined,
  storage: AttachmentStorage = localAttachmentStorage,
): Promise<AttachmentMetadataResponse> {
  const ticket = await requireOwnedTicket(prisma, requesterHeader, rawTicketId);
  if (!file) {
    throw new AttachmentFileRequiredError();
  }

  validateAttachmentFile(file);
  const activeCount = await prisma.attachment.count({
    where: { ticketId: ticket.id, removedAt: null },
  });
  if (activeCount >= maxActiveAttachmentCount) {
    throw new ActiveAttachmentLimitReachedError();
  }

  const storageKey = generateStorageKey();
  try {
    await storage.save(storageKey, file.buffer);
  } catch (error) {
    if (error instanceof AttachmentStorageUnavailableError) {
      throw error;
    }
    throw new AttachmentStorageUnavailableError();
  }

  try {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        storageKey,
        displayName: sanitizeDisplayName(file.originalname),
        mimeType: file.mimetype.toLowerCase(),
        sizeBytes: file.size,
      },
    });
    return toAttachmentMetadata(attachment, ticket.id);
  } catch {
    await storage.remove(storageKey).catch(() => undefined);
    throw new AttachmentUploadFailedError();
  }
}

async function findOwnedAttachment(
  prisma: AttachmentStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
  rawAttachmentId: unknown,
) {
  const ticket = await requireOwnedTicket(prisma, requesterHeader, rawTicketId);
  const attachmentId = parseAttachmentId(rawAttachmentId);
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId: ticket.id },
  });

  if (!attachment) {
    throw new AttachmentNotFoundError();
  }

  return { ticket, attachment };
}

export async function downloadTicketAttachment(
  prisma: AttachmentStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
  rawAttachmentId: unknown,
  storage: AttachmentStorage = localAttachmentStorage,
) {
  const { ticket, attachment } = await findOwnedAttachment(
    prisma,
    requesterHeader,
    rawTicketId,
    rawAttachmentId,
  );
  if (attachment.removedAt !== null) {
    throw new AttachmentRemovedError();
  }

  let content: Buffer;
  try {
    content = await storage.read(attachment.storageKey);
  } catch (error) {
    if (error instanceof AttachmentStorageUnavailableError) {
      throw error;
    }
    throw new AttachmentStorageUnavailableError();
  }

  return { ticketId: ticket.id, attachment, content };
}

export async function removeTicketAttachment(
  prisma: AttachmentStore,
  requesterHeader: string | undefined,
  rawTicketId: unknown,
  rawAttachmentId: unknown,
  rawRemovalReason: unknown,
) {
  const { ticket, attachment } = await findOwnedAttachment(
    prisma,
    requesterHeader,
    rawTicketId,
    rawAttachmentId,
  );
  if (attachment.removedAt !== null) {
    throw new AttachmentAlreadyRemovedError();
  }

  const removalReason = validateRemovalReason(rawRemovalReason);
  await prisma.attachment.update({
    where: { id: attachment.id },
    data: {
      removedAt: new Date(),
      removalReason,
    },
  });
  return ticket;
}
