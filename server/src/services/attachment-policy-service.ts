export const attachmentMaxSizeBytes = 5 * 1024 * 1024;
export const maxActiveAttachmentCount = 5;

const allowedMimeTypesByExtension = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
} as const;

export type AttachmentUploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
};

export type ValidatedAttachmentFile = {
  extension: string;
  mimetype: string;
};

export class AttachmentUploadInvalidError extends Error {
  readonly code = "ATTACHMENT_UPLOAD_INVALID";

  constructor() {
    super("ATTACHMENT_UPLOAD_INVALID");
    this.name = "AttachmentUploadInvalidError";
  }
}

export class AttachmentTypeNotAllowedError extends Error {
  readonly code = "ATTACHMENT_TYPE_NOT_ALLOWED";

  constructor() {
    super("ATTACHMENT_TYPE_NOT_ALLOWED");
    this.name = "AttachmentTypeNotAllowedError";
  }
}

export class AttachmentTooLargeError extends Error {
  readonly code = "ATTACHMENT_TOO_LARGE";

  constructor() {
    super("ATTACHMENT_TOO_LARGE");
    this.name = "AttachmentTooLargeError";
  }
}

export class RemovalReasonInvalidError extends Error {
  readonly code = "REMOVAL_REASON_INVALID";

  constructor() {
    super("REMOVAL_REASON_INVALID");
    this.name = "RemovalReasonInvalidError";
  }
}

export function validateAttachmentFile(
  file: AttachmentUploadFile,
): ValidatedAttachmentFile {
  if (
    typeof file.originalname !== "string" ||
    typeof file.mimetype !== "string" ||
    !Number.isSafeInteger(file.size) ||
    file.size < 0
  ) {
    throw new AttachmentUploadInvalidError();
  }

  if (file.size > attachmentMaxSizeBytes) {
    throw new AttachmentTooLargeError();
  }

  const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  const expectedMimeType =
    allowedMimeTypesByExtension[
      extension as keyof typeof allowedMimeTypesByExtension
    ];

  if (!expectedMimeType || file.mimetype.toLowerCase() !== expectedMimeType) {
    throw new AttachmentTypeNotAllowedError();
  }

  return { extension, mimetype: expectedMimeType };
}

export function validateRemovalReason(value: unknown) {
  if (typeof value !== "string") {
    throw new RemovalReasonInvalidError();
  }

  const reason = value.trim();
  if (reason.length < 3 || reason.length > 200) {
    throw new RemovalReasonInvalidError();
  }

  return reason;
}

export function sanitizeDisplayName(value: string) {
  const sanitized = [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join("")
    .replace(/[\\/]/g, "_")
    .trim()
    .slice(0, 255);
  return sanitized || "attachment";
}
