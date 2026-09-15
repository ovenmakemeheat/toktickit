import { createHash, randomBytes } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

export const sessionCookieName = "toktickit_session";
export const csrfCookieName = "toktickit_csrf";
export const sessionLifetimeMs = 8 * 60 * 60 * 1000;

export const authenticatedUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  passwordHash: true,
  active: true,
  mustChangePassword: true,
  legacyDevelopmentRequesterId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type AuthenticatedUser = Prisma.UserGetPayload<{
  select: typeof authenticatedUserSelect;
}>;

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: AuthenticatedUser["role"];
  active: boolean;
  mustChangePassword: boolean;
};

export type SessionCredentials = {
  token: string;
  csrfToken: string;
  expiresAt: Date;
};

export type CreatedSession = SessionCredentials & {
  id: number;
};

type SessionStore = Pick<PrismaClient, "session">;

export function toPublicUser(user: AuthenticatedUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
  };
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionCredentials(now = new Date()): SessionCredentials {
  return {
    token: randomBytes(32).toString("base64url"),
    csrfToken: randomBytes(32).toString("base64url"),
    expiresAt: new Date(now.getTime() + sessionLifetimeMs),
  };
}

export async function createSession(
  prisma: SessionStore,
  userId: number,
  now = new Date(),
  credentials = createSessionCredentials(now),
): Promise<CreatedSession> {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(credentials.token),
      csrfTokenHash: hashSessionToken(credentials.csrfToken),
      expiresAt: credentials.expiresAt,
    },
    select: { id: true },
  });

  return { ...credentials, id: session.id };
}

export async function findValidSession(
  prisma: PrismaClient,
  token: string | undefined,
  now = new Date(),
) {
  if (!token) {
    return null;
  }

  return prisma.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: now },
      user: { active: true },
    },
    include: { user: { select: authenticatedUserSelect } },
  });
}

export async function revokeSession(prisma: SessionStore, sessionId: number) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(
  prisma: SessionStore,
  userId: number,
  now = new Date(),
) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}
