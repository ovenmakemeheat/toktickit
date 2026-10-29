import { describe, expect, it } from "vitest";

import {
  ActionTakenInputValidationError,
  createActionTakenRequestFingerprint,
  normalizeActionTakenCreateInput,
  normalizeActionTakenPatchInput,
} from "../../src/services/actions-taken-service.js";

const validCreate = {
  actionAt: "2026-09-26T15:45:00+02:00",
  actionDescription: "  Reset the account lock  ",
  result: "  Sign-in now works  ",
  followUpRequired: false,
  followUpNote: "discarded when follow-up is false",
  attachmentNotes: "  See login-error.png  ",
};

describe("Actions Taken input normalization", () => {
  it("normalizes UTC and trimmed fields and clears an unused follow-up note", () => {
    expect(normalizeActionTakenCreateInput(validCreate)).toEqual({
      actionAt: new Date("2026-09-26T13:45:00.000Z"),
      actionDescription: "Reset the account lock",
      result: "Sign-in now works",
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: "See login-error.png",
    });
  });

  it("requires a useful follow-up note only when follow-up is required", () => {
    expect(() =>
      normalizeActionTakenCreateInput({
        ...validCreate,
        followUpRequired: true,
        followUpNote: "   ",
      }),
    ).toThrow(ActionTakenInputValidationError);

    expect(
      normalizeActionTakenCreateInput({
        ...validCreate,
        followUpRequired: true,
        followUpNote: "  Confirm access next class  ",
      }).followUpNote,
    ).toBe("Confirm access next class");
  });

  it.each([
    [{ ...validCreate, actionDescription: "   " }],
    [{ ...validCreate, result: "" }],
    [{ ...validCreate, actionDescription: "x".repeat(2_001) }],
    [{ ...validCreate, result: "x".repeat(2_001) }],
    [{ ...validCreate, attachmentNotes: "x".repeat(2_001) }],
    [{ ...validCreate, actionAt: "2026-09-26T13:45:00" }],
    [{ ...validCreate, actionAt: "2026-02-30T13:45:00Z" }],
    [{ ...validCreate, actionAt: "not-a-date" }],
    [{ ...validCreate, followUpRequired: "false" }],
    [{ ...validCreate, extra: "not allowed" }],
  ])("rejects invalid create input %#", (input) => {
    expect(() => normalizeActionTakenCreateInput(input)).toThrow(
      ActionTakenInputValidationError,
    );
  });

  it("normalizes equivalent create requests to the same immutable fingerprint", () => {
    const first = normalizeActionTakenCreateInput(validCreate);
    const second = normalizeActionTakenCreateInput({
      ...validCreate,
      actionAt: "2026-09-26T13:45:00Z",
      actionDescription: "Reset the account lock",
      result: "Sign-in now works",
      followUpNote: null,
      attachmentNotes: "See login-error.png",
    });

    expect(
      createActionTakenRequestFingerprint(315, 12, first).equals(
        createActionTakenRequestFingerprint(315, 12, second),
      ),
    ).toBe(true);
    expect(
      createActionTakenRequestFingerprint(316, 12, first).equals(
        createActionTakenRequestFingerprint(315, 12, first),
      ),
    ).toBe(false);
    expect(
      createActionTakenRequestFingerprint(315, 13, first).equals(
        createActionTakenRequestFingerprint(315, 12, first),
      ),
    ).toBe(false);
  });

  it("accepts only known, versioned, non-empty edit payloads", () => {
    expect(
      normalizeActionTakenPatchInput({
        expectedVersion: 2,
        result: "  Verified from a second device  ",
      }),
    ).toEqual({
      expectedVersion: 2,
      result: "Verified from a second device",
    });

    for (const input of [
      { expectedVersion: 0, result: "Updated" },
      { expectedVersion: 1 },
      { expectedVersion: 1, performedByUserId: 3 },
      { expectedVersion: 1, actionDescription: "x".repeat(2_001) },
    ]) {
      expect(() => normalizeActionTakenPatchInput(input)).toThrow(
        ActionTakenInputValidationError,
      );
    }
  });
});
