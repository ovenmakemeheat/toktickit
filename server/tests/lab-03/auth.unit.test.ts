import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  hashPassword,
  passwordMaxLength,
  passwordMinLength,
  validatePassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from "../../src/services/password-service.js";
import {
  createSessionCredentials,
  hashSessionToken,
  sessionLifetimeMs,
} from "../../src/services/session-service.js";

function createRuntimePassword() {
  return `${randomBytes(24).toString("base64url")}${String.fromCharCode(65, 49, 33)}`;
}

describe("Lab 3 authentication primitives", () => {
  it("enforces the documented password boundaries", () => {
    expect(validatePassword("short")).toMatchObject({
      code: "PASSWORD_POLICY_INVALID",
    });
    expect(
      validatePassword(`${"1".repeat(11)}${String.fromCharCode(33)}`),
    ).toMatchObject({
      code: "PASSWORD_POLICY_INVALID",
    });
    expect(
      validatePassword(`${"a".repeat(12)}${String.fromCharCode(33)}`),
    ).toMatchObject({
      code: "PASSWORD_POLICY_INVALID",
    });
    expect(validatePassword(`A${"b".repeat(10)}1`)).toMatchObject({
      code: "PASSWORD_POLICY_INVALID",
    });
    expect(
      validatePassword(
        `${String.fromCharCode(65, 49, 33)}${"a".repeat(passwordMaxLength - 3)}`,
      ),
    ).toBe(null);
    expect(
      validatePassword(
        `${String.fromCharCode(65, 49, 33)}${"a".repeat(passwordMaxLength - 2)}`,
      ),
    ).toMatchObject({ code: "PASSWORD_POLICY_INVALID" });
    expect(passwordMinLength).toBe(12);
    expect(passwordMaxLength).toBe(128);
  });

  it("uses salted hashes and timing-safe password comparison", async () => {
    const password = createRuntimePassword();
    const wrongPassword = createRuntimePassword();
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
    expect(firstHash).not.toContain(password);
    expect(await verifyPassword(password, firstHash)).toBe(true);
    expect(await verifyPassword(wrongPassword, firstHash)).toBe(false);
    expect(await verifyPassword(wrongPassword, "invalid-hash")).toBe(false);
    expect(await verifyPasswordOrDummy(wrongPassword, undefined)).toBe(false);
  });

  it("creates expiring opaque session credentials and stores only token hashes", () => {
    const now = new Date("2026-09-13T08:00:00.000Z");
    const credentials = createSessionCredentials(now);

    expect(credentials.token).toEqual(expect.any(String));
    expect(credentials.csrfToken).toEqual(expect.any(String));
    expect(credentials.token).not.toBe(credentials.csrfToken);
    expect(credentials.expiresAt).toEqual(
      new Date(now.getTime() + sessionLifetimeMs),
    );
    expect(hashSessionToken(credentials.token)).not.toContain(
      credentials.token,
    );
    expect(hashSessionToken(credentials.token)).toHaveLength(64);
  });
});
