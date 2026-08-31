import { describe, expect, it } from "vitest";

import {
  attachmentMaxSizeBytes,
  validateAttachmentContent,
  validateAttachmentFile,
  validateRemovalReason,
} from "../../src/services/attachment-policy-service.js";

describe("attachment policy", () => {
  it.each([
    ["evidence.jpg", "image/jpeg"],
    ["evidence.jpeg", "image/jpeg"],
    ["evidence.png", "image/png"],
    ["evidence.webp", "image/webp"],
    ["evidence.pdf", "application/pdf"],
  ])("accepts the permitted %s type", (originalname, mimetype) => {
    expect(
      validateAttachmentFile({ originalname, mimetype, size: 12 }),
    ).toEqual({ extension: originalname.split(".").pop(), mimetype });
  });

  it("rejects an unsupported extension, a MIME mismatch, and an oversized file", () => {
    expect(() =>
      validateAttachmentFile({
        originalname: "evidence.exe",
        mimetype: "application/octet-stream",
        size: 12,
      }),
    ).toThrowError("ATTACHMENT_TYPE_NOT_ALLOWED");
    expect(() =>
      validateAttachmentFile({
        originalname: "evidence.png",
        mimetype: "image/jpeg",
        size: 12,
      }),
    ).toThrowError("ATTACHMENT_TYPE_NOT_ALLOWED");
    expect(() =>
      validateAttachmentFile({
        originalname: "evidence.pdf",
        mimetype: "application/pdf",
        size: attachmentMaxSizeBytes + 1,
      }),
    ).toThrowError("ATTACHMENT_TOO_LARGE");
  });

  it.each([
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
    [
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    [
      "image/webp",
      Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]),
    ],
    ["application/pdf", Buffer.from("%PDF-1.7")],
  ])("accepts a matching %s file signature", (mimetype, buffer) => {
    expect(() =>
      validateAttachmentContent({
        originalname: "evidence.bin",
        mimetype,
        size: buffer.length,
        buffer,
      }),
    ).not.toThrow();
  });

  it("rejects content whose signature does not match the declared MIME type", () => {
    expect(() =>
      validateAttachmentContent({
        originalname: "evidence.pdf",
        mimetype: "application/pdf",
        size: 16,
        buffer: Buffer.from("not a PDF"),
      }),
    ).toThrowError("ATTACHMENT_TYPE_NOT_ALLOWED");
  });

  it("trims and validates the required removal reason", () => {
    expect(validateRemovalReason("  no longer needed  ")).toBe(
      "no longer needed",
    );
    expect(() => validateRemovalReason("no")).toThrowError(
      "REMOVAL_REASON_INVALID",
    );
    expect(() => validateRemovalReason("x".repeat(201))).toThrowError(
      "REMOVAL_REASON_INVALID",
    );
  });
});
