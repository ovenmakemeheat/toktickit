import { timingSafeEqual } from "node:crypto";

import type { Request, RequestHandler, Response } from "express";
import type { PrismaClient } from "@prisma/client";

import {
  csrfCookieName,
  createSessionCredentials,
  findValidSession,
  hashSessionToken,
  sessionCookieName,
  type AuthenticatedUser,
} from "./session-service.js";

export type AuthContext = {
  sessionId: number;
  token: string;
  user: AuthenticatedUser;
  expiresAt: Date;
  csrfTokenHash: string;
};

export class SessionRequiredError extends Error {
  readonly code = "SESSION_REQUIRED";

  constructor() {
    super("An authenticated session is required.");
    this.name = "SessionRequiredError";
  }
}

export class PasswordChangeRequiredError extends Error {
  readonly code = "PASSWORD_CHANGE_REQUIRED";

  constructor() {
    super("Change your initial password before continuing.");
    this.name = "PasswordChangeRequiredError";
  }
}

export class RoleForbiddenError extends Error {
  readonly code = "ROLE_FORBIDDEN";

  constructor() {
    super("Your account is not allowed to perform this action.");
    this.name = "RoleForbiddenError";
  }
}

export class CsrfTokenInvalidError extends Error {
  readonly code = "CSRF_TOKEN_INVALID";

  constructor() {
    super("The security token is invalid or missing.");
    this.name = "CsrfTokenInvalidError";
  }
}

function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) {
      continue;
    }
    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  }

  return cookies;
}

export function readCookie(request: Request, name: string) {
  return parseCookies(request.get("Cookie")).get(name);
}

export function setSessionCookies(
  response: Response,
  token: string,
  csrfToken: string,
  maxAge: number,
) {
  const secure = process.env.NODE_ENV === "production";
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  });
  response.cookie(csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  });
}

export function clearSessionCookies(response: Response) {
  response.clearCookie(sessionCookieName, { path: "/" });
  response.clearCookie(csrfCookieName, { path: "/" });
}

export async function ensureCsrfToken(
  prisma: PrismaClient,
  request: Request,
  response: Response,
) {
  const auth = request.auth;
  if (!auth) {
    throw new SessionRequiredError();
  }

  const existingToken = readCookie(request, csrfCookieName);
  if (existingToken && hashSessionToken(existingToken) === auth.csrfTokenHash) {
    return existingToken;
  }

  const credentials = createSessionCredentials();
  await prisma.session.update({
    where: { id: auth.sessionId },
    data: { csrfTokenHash: hashSessionToken(credentials.csrfToken) },
  });
  setSessionCookies(
    response,
    auth.token,
    credentials.csrfToken,
    Math.max(0, auth.expiresAt.getTime() - Date.now()),
  );
  return credentials.csrfToken;
}

export async function loadAuthContext(
  prisma: PrismaClient,
  request: Request,
): Promise<AuthContext | null> {
  const token = readCookie(request, sessionCookieName);
  const session = await findValidSession(prisma, token);
  if (!session || !token) {
    return null;
  }

  return {
    sessionId: session.id,
    token,
    user: session.user,
    expiresAt: session.expiresAt,
    csrfTokenHash: session.csrfTokenHash,
  };
}

export function attachAuthContext(prisma: PrismaClient): RequestHandler {
  return (request, _response, next) => {
    void loadAuthContext(prisma, request)
      .then((auth) => {
        request.auth = auth ?? undefined;
        next();
      })
      .catch(next);
  };
}

export function requireAuthentication(options?: {
  allowPasswordChange?: boolean;
  roles?: AuthenticatedUser["role"][];
}): RequestHandler {
  const allowPasswordChange = options?.allowPasswordChange ?? false;
  const roles = options?.roles;

  return (request, response, next) => {
    const auth = request.auth;
    if (!auth) {
      response.status(401).json({
        error: {
          code: "SESSION_REQUIRED",
          message: "An authenticated session is required.",
        },
      });
      return;
    }

    if (!allowPasswordChange && auth.user.mustChangePassword) {
      response.status(403).json({
        error: {
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Change your initial password before continuing.",
        },
      });
      return;
    }

    if (roles && !roles.includes(auth.user.role)) {
      response.status(403).json({
        error: {
          code: "ROLE_FORBIDDEN",
          message: "Your account is not allowed to perform this action.",
        },
      });
      return;
    }

    next();
  };
}

export function requireCsrfToken(
  request: Request,
  response: Response,
): boolean {
  if (!request.auth) {
    response.status(401).json({
      error: {
        code: "SESSION_REQUIRED",
        message: "An authenticated session is required.",
      },
    });
    return false;
  }

  const cookieToken = readCookie(request, csrfCookieName);
  const headerToken = request.get("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    response.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "The security token is invalid or missing.",
      },
    });
    return false;
  }

  const expectedHash = Buffer.from(request.auth.csrfTokenHash, "utf8");
  const receivedHash = Buffer.from(hashSessionToken(headerToken), "utf8");
  if (
    expectedHash.length !== receivedHash.length ||
    !timingSafeEqual(expectedHash, receivedHash)
  ) {
    response.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "The security token is invalid or missing.",
      },
    });
    return false;
  }

  const origin = request.get("Origin");
  const expectedOrigin = process.env.APP_ORIGIN ?? "http://localhost:5173";
  if (origin && origin !== expectedOrigin) {
    response.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "The security token is invalid or missing.",
      },
    });
    return false;
  }

  return true;
}

export function getAuthContext(request: Request) {
  if (!request.auth) {
    throw new SessionRequiredError();
  }
  return request.auth;
}

export function getNormalAuthContext(request: Request) {
  const auth = getAuthContext(request);
  if (auth.user.mustChangePassword) {
    throw new PasswordChangeRequiredError();
  }
  return auth;
}

export function assertRole(
  request: Request,
  roles: AuthenticatedUser["role"][],
) {
  const auth = getNormalAuthContext(request);
  if (!roles.includes(auth.user.role)) {
    throw new RoleForbiddenError();
  }
  return auth;
}

export function sendAuthError(response: Response, error: unknown) {
  if (error instanceof SessionRequiredError) {
    response.status(401).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (error instanceof PasswordChangeRequiredError) {
    response.status(403).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (error instanceof RoleForbiddenError) {
    response.status(403).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  throw error;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
