import { Prisma, type PrismaClient } from "@prisma/client";

import {
  normalizeEmail,
  parseLoginInput,
  parsePasswordChangeInput,
  type PasswordChangeInput,
} from "./auth-validation-service.js";
import { hashPassword, verifyPasswordOrDummy } from "./password-service.js";
import {
  authenticatedUserSelect,
  createSession,
  createSessionCredentials,
  hashSessionToken,
  revokeUserSessions,
  toPublicUser,
  type AuthenticatedUser,
  type CreatedSession,
  type PublicUser,
} from "./session-service.js";

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("Email or password is incorrect.");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountInactiveError extends Error {
  readonly code = "ACCOUNT_INACTIVE";

  constructor() {
    super("This account is inactive. Contact an administrator.");
    this.name = "AccountInactiveError";
  }
}

export class CurrentPasswordInvalidError extends Error {
  readonly code = "CURRENT_PASSWORD_INVALID";

  constructor() {
    super("Current password is incorrect.");
    this.name = "CurrentPasswordInvalidError";
  }
}

export class PasswordReuseNotAllowedError extends Error {
  readonly code = "PASSWORD_REUSE_NOT_ALLOWED";

  constructor() {
    super("Choose a password different from the current password.");
    this.name = "PasswordReuseNotAllowedError";
  }
}

export type LoginResult = {
  user: PublicUser;
  session: CreatedSession;
};

export type PasswordChangeResult = LoginResult;

export async function login(
  prisma: PrismaClient,
  rawInput: unknown,
  now = new Date(),
): Promise<LoginResult> {
  const input = parseLoginInput(rawInput);
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(input.email) },
    select: authenticatedUserSelect,
  });
  const passwordMatches = await verifyPasswordOrDummy(
    input.password,
    user?.passwordHash,
  );

  if (!user || !passwordMatches) {
    throw new InvalidCredentialsError();
  }
  if (!user.active) {
    throw new AccountInactiveError();
  }

  const session = await createSession(prisma, user.id, now);
  return { user: toPublicUser(user), session };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function changePassword(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  rawInput: unknown,
  now = new Date(),
): Promise<PasswordChangeResult> {
  const input = parsePasswordChangeInput(rawInput);
  const currentMatches = await verifyPasswordOrDummy(
    input.currentPassword,
    user.passwordHash,
  );
  if (!currentMatches) {
    throw new CurrentPasswordInvalidError();
  }

  if (await verifyPasswordOrDummy(input.newPassword, user.passwordHash)) {
    throw new PasswordReuseNotAllowedError();
  }

  const credentials = createSessionCredentials(now);
  const passwordHash = await hashPassword(input.newPassword);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
        select: authenticatedUserSelect,
      });
      await transaction.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      const session = await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: hashSessionToken(credentials.token),
          csrfTokenHash: hashSessionToken(credentials.csrfToken),
          expiresAt: credentials.expiresAt,
        },
        select: { id: true },
      });

      return { updatedUser, session };
    });

    return {
      user: toPublicUser(result.updatedUser),
      session: { ...credentials, id: result.session.id },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Unable to create an authenticated session");
    }
    throw error;
  }
}

export async function invalidateAllSessions(
  prisma: PrismaClient,
  userId: number,
) {
  await revokeUserSessions(prisma, userId);
}

export type { PasswordChangeInput };
