import type { PublicUser } from "../../src/lib/api";

export type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  blob?: () => Promise<Blob>;
};

export const requesterUser = {
  id: 11,
  name: "Requester A",
  email: "requester-a@toktickit.test",
  role: "REQUESTER" as const,
  active: true,
  mustChangePassword: false,
};

export const requesterAuthResponse = {
  user: requesterUser,
  session: { expiresAt: "2026-08-29T17:00:00.000Z" },
  csrfToken: "csrf-token",
};

export function response(
  body: unknown,
  ok = true,
  status = ok ? 200 : 400,
): MockResponse {
  return {
    ok,
    status,
    json: async () => body,
  };
}

export function sessionResponse(overrides: Partial<PublicUser> = {}) {
  return {
    ...requesterAuthResponse,
    user: { ...requesterAuthResponse.user, ...overrides },
  };
}
