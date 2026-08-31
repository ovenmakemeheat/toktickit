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

function startsWithBytes(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function validateAttachmentContent(
  file: AttachmentUploadFile & { buffer: Buffer },
) {
  const mimeType = file.mimetype.toLowerCase();
  const hasValidSignature =
    (mimeType === "image/jpeg" &&
      startsWithBytes(file.buffer, [0xff, 0xd8, 0xff])) ||
    (mimeType === "image/png" &&
      startsWithBytes(
        file.buffer,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      )) ||
    (mimeType === "image/webp" &&
      startsWithBytes(file.buffer, [0x52, 0x49, 0x46, 0x46]) &&
      startsWithBytes(file.buffer.subarray(8), [0x57, 0x45, 0x42, 0x50])) ||
    (mimeType === "application/pdf" &&
      startsWithBytes(file.buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]));

  if (!hasValidSignature) {
    throw new AttachmentTypeNotAllowedError();
  }
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
