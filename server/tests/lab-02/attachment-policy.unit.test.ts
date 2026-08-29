import { describe, expect, it } from "vitest";

import {
  attachmentMaxSizeBytes,
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
