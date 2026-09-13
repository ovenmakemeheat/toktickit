import { execFile as callbackExecFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/services/password-service.js";

const execFile = promisify(callbackExecFile);
const prisma = new PrismaClient();
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

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
  try {
    await access(handoffPath);
    throw new Error(
      "Migration handoff file already exists; refusing to overwrite it",
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function writeHandoff(
  handoffPath: string,
  credentials: Array<{ email: string; initialPassword: string }>,
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

  const requesters = await prisma.developmentRequester.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, email: true, active: true },
  });
  const ticketsBefore = await prisma.ticket.count();
  const attachmentsBefore = await prisma.attachment.count();
  const newCredentials: Array<{ email: string; initialPassword: string }> = [];
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

    const initialPassword = `${randomBytes(18).toString("base64url")}!a1`;
    newCredentials.push({ email, initialPassword });
    userData.set(requester.id, {
      name: requester.name,
      email,
      active: requester.active,
      passwordHash: await hashPassword(initialPassword),
    });
  }

  await writeHandoff(handoffPath, newCredentials);
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
      await transaction.$executeRawUnsafe(
        'ALTER TABLE "Ticket" ALTER COLUMN "requesterUserId" SET NOT NULL',
      );
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
      `Migrated ${newCredentials.length} new User credential(s); handoff written to ${handoffPath}.\n`,
    );
  } catch (error) {
    if (!transactionCommitted) {
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
