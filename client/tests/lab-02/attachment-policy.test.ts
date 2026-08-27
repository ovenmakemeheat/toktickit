import { describe, expect, it } from "vitest";

import {
  maxActiveAttachmentCount,
  maxAttachmentSizeBytes,
  validateAttachmentFile,
  validateAttachmentSelection,
} from "../../src/lib/attachment-policy";

describe("Lab 2 attachment selection policy", () => {
  it("accepts permitted extensions when the MIME type matches", () => {
    const file = new File(["image"], "evidence.JPG", { type: "image/jpeg" });

    expect(validateAttachmentFile(file)).toBeNull();
  });

  it("rejects unsupported extensions and mismatched MIME types", () => {
    expect(
      validateAttachmentFile(
        new File(["text"], "notes.txt", { type: "text/plain" }),
      ),
    ).toContain("Only JPG");
    expect(
      validateAttachmentFile(
        new File(["image"], "evidence.png", { type: "image/jpeg" }),
      ),
    ).toContain("does not match");
  });

  it("rejects files larger than 5 MB", () => {
    const file = new File(
      [new Uint8Array(maxAttachmentSizeBytes + 1)],
      "large.pdf",
      { type: "application/pdf" },
    );

    expect(validateAttachmentFile(file)).toContain("5 MB");
  });

  it("rejects the sixth active selection while keeping the first five", () => {
    const files = Array.from(
      { length: maxActiveAttachmentCount + 1 },
      (_, index) =>
        new File([`image-${index}`], `image-${index}.png`, {
          type: "image/png",
        }),
    );

    const results = validateAttachmentSelection(files);

    expect(results.filter((result) => result.error === null)).toHaveLength(5);
    expect(results.at(-1)?.error).toContain("at most five");
  });
});
