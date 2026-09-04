import type { PrismaClient } from "@prisma/client";

type RequesterStore = Pick<PrismaClient, "developmentRequester">;

export class RequesterContextRequiredError extends Error {
  readonly code = "REQUESTER_CONTEXT_REQUIRED";

  constructor() {
    super("Development Requester context is required");
    this.name = "RequesterContextRequiredError";
  }
}

export class RequesterContextInvalidError extends Error {
  readonly code = "REQUESTER_CONTEXT_INVALID";

  constructor() {
    super("Development Requester context is invalid");
    this.name = "RequesterContextInvalidError";
  }
}

function parseRequesterId(headerValue: string | undefined) {
  if (!headerValue) {
    throw new RequesterContextRequiredError();
  }

  const normalized = headerValue.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new RequesterContextInvalidError();
  }

  const requesterId = Number(normalized);
  if (!Number.isSafeInteger(requesterId) || requesterId < 1) {
    throw new RequesterContextInvalidError();
  }

  return requesterId;
}

export async function requireActiveRequester(
  prisma: RequesterStore,
  headerValue: string | undefined,
) {
  const requesterId = parseRequesterId(headerValue);
  const requester = await prisma.developmentRequester.findFirst({
    where: { id: requesterId, active: true },
    select: { id: true, name: true, email: true },
  });

  if (!requester) {
    throw new RequesterContextInvalidError();
  }

  return requester;
}
