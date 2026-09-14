import { execFile as callbackExecFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";

import {
  hashPassword,
  validatePassword,
} from "../src/services/password-service.js";
import {
  ensureRequesterOwnershipConstraint,
  validateRequesterOwnershipConstraint,
} from "../src/services/ticket-ownership-service.js";

const execFile = promisify(callbackExecFile);
const prisma = new PrismaClient();
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

type HandoffCredential = {
  email: string;
  initialPassword: string;
};

type Handoff = {
  generatedAt: string;
  users: HandoffCredential[];
};

function parseHandoffPath() {
  const handoffIndex = process.argv.indexOf("--handoff");
  const rawHandoffPath =
    handoffIndex >= 0 ? process.argv[handoffIndex + 1] : undefined;
  if (!rawHandoffPath || rawHandoffPath.startsWith("-")) {
    throw new Error(
      "Usage: bun run db:migrate:lab3 -- --handoff <ignored-local-file>",
    );
  }

  const normalizedPath = rawHandoffPath.replaceAll("\\", "/");
  if (
    normalizedPath.startsWith("server/") &&
    resolve(process.cwd()) === resolve(repositoryRoot, "server")
  ) {
    return resolve(repositoryRoot, rawHandoffPath);
  }
  return resolve(process.cwd(), rawHandoffPath);
}

async function pathIsTracked(relativePath: string) {
  try {
    await execFile("git", ["ls-files", "--error-unmatch", "--", relativePath], {
      cwd: repositoryRoot,
    });
    return true;
  } catch {
    return false;
  }
}

async function pathIsIgnored(relativePath: string) {
  try {
    await execFile("git", ["check-ignore", "--quiet", "--", relativePath], {
      cwd: repositoryRoot,
    });
    return true;
  } catch {
    return false;
  }
}

async function assertSafeHandoffPath(handoffPath: string) {
  const relativePath = relative(repositoryRoot, handoffPath).replaceAll(
    "\\",
    "/",
  );
  if (
    !relativePath ||
    relativePath.startsWith("../") ||
    relativePath === ".."
  ) {
    throw new Error(
      "Migration handoff path must be inside the repository and ignored",
    );
  }
  if (await pathIsTracked(relativePath)) {
    throw new Error("Migration handoff path must not be tracked");
  }
  if (!(await pathIsIgnored(relativePath))) {
    throw new Error("Migration handoff path must be ignored by Git");
  }
}

function isFileNotFound(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseHandoff(contents: string): Handoff {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error("Migration handoff file is invalid");
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("Migration handoff file is invalid");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.generatedAt !== "string" || !Array.isArray(record.users)) {
    throw new Error("Migration handoff file is invalid");
  }

  const emails = new Set<string>();
  const users: HandoffCredential[] = [];
  for (const candidate of record.users) {
    if (typeof candidate !== "object" || candidate === null) {
      throw new Error("Migration handoff file is invalid");
    }
    const credential = candidate as Record<string, unknown>;
    if (
      typeof credential.email !== "string" ||
      typeof credential.initialPassword !== "string" ||
      validatePassword(credential.initialPassword)
    ) {
      throw new Error("Migration handoff file is invalid");
    }

    const email = credential.email.trim().toLowerCase();
    if (!email || emails.has(email)) {
      throw new Error("Migration handoff file is invalid");
    }
    emails.add(email);
    users.push({ email, initialPassword: credential.initialPassword });
  }

  return { generatedAt: record.generatedAt, users };
}

async function readExistingHandoff(handoffPath: string) {
  try {
    return parseHandoff(await readFile(handoffPath, "utf8"));
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    if (
      error instanceof Error &&
      error.message === "Migration handoff file is invalid"
    ) {
      throw error;
    }
    throw new Error("Unable to read migration handoff file");
  }
}

async function writeHandoff(
  handoffPath: string,
  credentials: HandoffCredential[],
) {
  await mkdir(dirname(handoffPath), { recursive: true });
  await writeFile(
    handoffPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), users: credentials }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
}

async function migrate() {
  const handoffPath = parseHandoffPath();
  await assertSafeHandoffPath(handoffPath);
  const existingHandoff = await readExistingHandoff(handoffPath);
  const existingCredentials = new Map(
    existingHandoff?.users.map((credential) => [
      credential.email,
      credential,
    ]) ?? [],
  );

  const requesters = await prisma.developmentRequester.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, email: true, active: true },
  });
  const ticketsBefore = await prisma.ticket.count();
  const attachmentsBefore = await prisma.attachment.count();
  await ensureRequesterOwnershipConstraint(prisma);
  const newCredentials: HandoffCredential[] = [];
  const normalizedRequesterEmails = new Map<string, number>();
  for (const requester of requesters) {
    const email = requester.email.trim().toLowerCase();
    const previousRequesterId = normalizedRequesterEmails.get(email);
    if (
      previousRequesterId !== undefined &&
      previousRequesterId !== requester.id
    ) {
      throw new Error(
        `Duplicate normalized Development Requester email: ${email}`,
      );
    }
    normalizedRequesterEmails.set(email, requester.id);
  }
  const userData = new Map<
    number,
    { name: string; email: string; active: boolean; passwordHash?: string }
  >();

  for (const requester of requesters) {
    const email = requester.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, legacyDevelopmentRequesterId: true },
    });
    if (existing) {
      if (existing.role !== "REQUESTER") {
        throw new Error(`Existing User for ${email} is not a Requester`);
      }
      if (
        existing.legacyDevelopmentRequesterId !== null &&
        existing.legacyDevelopmentRequesterId !== requester.id
      ) {
        throw new Error(`Conflicting migration mapping for ${email}`);
      }
      userData.set(requester.id, {
        name: requester.name,
        email,
        active: requester.active,
      });
      continue;
    }

    const existingCredential = existingCredentials.get(email);
    const initialPassword =
      existingCredential?.initialPassword ??
      `${randomBytes(18).toString("base64url")}${String.fromCharCode(33, 97, 49)}`;
    if (!existingCredential) {
      newCredentials.push({ email, initialPassword });
    }
    userData.set(requester.id, {
      name: requester.name,
      email,
      active: requester.active,
      passwordHash: await hashPassword(initialPassword),
    });
  }

  if (existingHandoff && newCredentials.length > 0) {
    throw new Error(
      "Migration handoff already exists without credentials for every Requester; choose a new handoff path",
    );
  }
  const handoffWritten = !existingHandoff;
  if (handoffWritten) {
    await writeHandoff(handoffPath, newCredentials);
  }
  let transactionCommitted = false;
  try {
    await prisma.$transaction(async (transaction) => {
      const userIds = new Map<number, number>();
      for (const requester of requesters) {
        const data = userData.get(requester.id);
        if (!data) {
          throw new Error(`Unable to prepare migration for ${requester.email}`);
        }
        const existing = await transaction.user.findUnique({
          where: { email: data.email },
          select: { id: true, role: true, legacyDevelopmentRequesterId: true },
        });
        if (existing?.role !== undefined && existing.role !== "REQUESTER") {
          throw new Error(`Existing User for ${data.email} is not a Requester`);
        }
        if (
          existing?.legacyDevelopmentRequesterId !== null &&
          existing?.legacyDevelopmentRequesterId !== undefined &&
          existing.legacyDevelopmentRequesterId !== requester.id
        ) {
          throw new Error(`Conflicting migration mapping for ${data.email}`);
        }
        const user = existing
          ? await transaction.user.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                active: data.active,
                legacyDevelopmentRequesterId: requester.id,
              },
              select: { id: true },
            })
          : await transaction.user.create({
              data: {
                name: data.name,
                email: data.email,
                role: "REQUESTER",
                passwordHash: data.passwordHash as string,
                active: data.active,
                mustChangePassword: true,
                legacyDevelopmentRequesterId: requester.id,
              },
              select: { id: true },
            });
        userIds.set(requester.id, user.id);
      }

      for (const requester of requesters) {
        const userId = userIds.get(requester.id);
        if (!userId) {
          throw new Error(
            `Unable to map Development Requester ${requester.id}`,
          );
        }
        const conflicting = await transaction.ticket.findFirst({
          where: {
            requesterId: requester.id,
            requesterUserId: { not: userId },
          },
          select: { id: true },
        });
        if (conflicting) {
          throw new Error(
            `Conflicting requester ownership for Ticket ${conflicting.id}`,
          );
        }
        await transaction.ticket.updateMany({
          where: { requesterId: requester.id, requesterUserId: null },
          data: { requesterUserId: userId },
        });
      }

      const orphanedTicket = await transaction.ticket.findFirst({
        where: { requesterUserId: null },
        select: { id: true },
      });
      if (orphanedTicket) {
        throw new Error(
          `Ticket ${orphanedTicket.id} has no migrated Requester User`,
        );
      }
      await validateRequesterOwnershipConstraint(transaction);
    });
    transactionCommitted = true;

    const ticketsAfter = await prisma.ticket.count();
    const attachmentsAfter = await prisma.attachment.count();
    if (
      ticketsAfter !== ticketsBefore ||
      attachmentsAfter !== attachmentsBefore
    ) {
      throw new Error("Migration changed Ticket or Attachment counts");
    }
    process.stdout.write(
      `Migrated ${newCredentials.length} new User credential(s); handoff ${
        existingHandoff ? "reused" : "written"
      } at ${handoffPath}.\n`,
    );
  } catch (error) {
    if (!transactionCommitted && handoffWritten) {
      await unlink(handoffPath).catch(() => undefined);
    }
    throw error;
  }
}

migrate()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Migration failed";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
