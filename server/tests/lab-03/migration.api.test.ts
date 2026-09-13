import { execFile as callbackExecFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedLab3Data } from "../../prisma/seed-lab3-data.js";
import { hashPassword } from "../../src/services/password-service.js";
import { localAttachmentStorage } from "../../src/services/attachment-storage-service.js";
import { app, lab3TestPassword, prisma } from "./test-helpers.js";

const execFile = promisify(callbackExecFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const serverRoot = resolve(repositoryRoot, "server");
const tsxExecutable = resolve(
  serverRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.exe" : "tsx",
);
const handoffFileName = `lab3-migration-${process.pid}-${Date.now()}.json`;
const handoffRelativePath = `server/.local/${handoffFileName}`;
const handoffPath = resolve(repositoryRoot, handoffRelativePath);

type Handoff = {
  users: Array<{ email: string; initialPassword: string }>;
};

const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const legacyEmail = `migrated-${marker}@toktickit.test`;
const ticketNumber = `TT-20260913-${marker.slice(-6).toUpperCase()}`;
let legacyRequesterId: number | undefined;
let ticketId: number | undefined;
let attachmentId: number | undefined;
const attachmentStorageKey = `migration-${marker}`;

function expectError(response: request.Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.objectContaining({ code }),
  });
}

async function runMigration(path: string) {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("The test database URL is not configured");
  }

  return execFile(
    tsxExecutable,
    ["scripts/migrate-lab3.ts", "--handoff", path],
    {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      maxBuffer: 1024 * 1024,
    },
  );
}

beforeAll(async () => {
  await mkdir(resolve(repositoryRoot, "server", ".local"), {
    recursive: true,
  });
  await seedLab3Data(prisma, lab3TestPassword);
});

afterAll(async () => {
  if (ticketId !== undefined) {
    await prisma.attachment.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
  await localAttachmentStorage
    .remove(attachmentStorageKey)
    .catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: legacyEmail } });
  if (legacyRequesterId !== undefined) {
    await prisma.developmentRequester.deleteMany({
      where: { id: legacyRequesterId },
    });
  }
  await unlink(handoffPath).catch(() => undefined);
  await unlink(
    resolve(repositoryRoot, "server", ".local", `${handoffFileName}.second`),
  ).catch(() => undefined);
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Ticket" ALTER COLUMN "requesterUserId" DROP NOT NULL',
  );
  await prisma.user.updateMany({
    data: {
      passwordHash: await hashPassword(lab3TestPassword),
      mustChangePassword: true,
    },
  });
  await prisma.session.deleteMany();
  await prisma.$disconnect();
});

describe("Lab 3 migration handoff", () => {
  it("preserves ownership and counts without printing or duplicating credentials", async () => {
    const seedCountsBefore = {
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
      attachments: await prisma.attachment.count(),
      publicComments: await prisma.publicComment.count(),
      internalNotes: await prisma.internalNote.count(),
    };
    await seedLab3Data(prisma, lab3TestPassword);
    expect(await prisma.user.count()).toBe(seedCountsBefore.users);
    expect(await prisma.ticket.count()).toBe(seedCountsBefore.tickets);
    expect(await prisma.attachment.count()).toBe(seedCountsBefore.attachments);
    expect(await prisma.publicComment.count()).toBe(
      seedCountsBefore.publicComments,
    );
    expect(await prisma.internalNote.count()).toBe(
      seedCountsBefore.internalNotes,
    );

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Ticket" ALTER COLUMN "requesterUserId" DROP NOT NULL',
    );
    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Hardware" },
      select: { id: true },
    });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({
      where: { name: "VPN" },
      select: { id: true },
    });
    const legacyRequester = await prisma.developmentRequester.create({
      data: {
        name: "Migrated Regression Requester",
        email: legacyEmail,
      },
      select: { id: true },
    });
    legacyRequesterId = legacyRequester.id;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        clientRequestId: randomUUID(),
        ticketDate: new Date("2026-09-13T08:00:00.000Z"),
        requesterId: legacyRequester.id,
        requestedPriority: "HIGH",
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Migration ownership regression",
        description:
          "This Ticket verifies ownership survives the Lab 3 migration.",
      },
      select: { id: true },
    });
    ticketId = ticket.id;

    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        storageKey: attachmentStorageKey,
        displayName: "migration-evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: 128,
      },
      select: { id: true },
    });
    attachmentId = attachment.id;
    await localAttachmentStorage.save(
      attachmentStorageKey,
      Buffer.from("migration attachment"),
    );

    const countsBefore = {
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
      attachments: await prisma.attachment.count(),
    };

    const first = await runMigration(handoffRelativePath);
    const handoff = JSON.parse(await readFile(handoffPath, "utf8")) as Handoff;
    expect(handoff.users).toHaveLength(1);
    const [credential] = handoff.users;
    if (!credential) {
      throw new Error("Migration did not return a User credential");
    }
    expect(credential.email).toBe(legacyEmail);
    expect(credential.initialPassword).toEqual(expect.any(String));
    expect(first.stdout).toContain("Migrated 1 new User credential(s)");
    expect(first.stdout).not.toContain(credential.initialPassword);

    const migratedUser = await prisma.user.findUniqueOrThrow({
      where: { email: legacyEmail },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
        passwordHash: true,
        legacyDevelopmentRequesterId: true,
      },
    });
    expect(migratedUser).toMatchObject({
      name: "Migrated Regression Requester",
      role: "REQUESTER",
      active: true,
      mustChangePassword: true,
      legacyDevelopmentRequesterId: legacyRequesterId,
    });
    expect(migratedUser.passwordHash).not.toBe(credential?.initialPassword);
    expect(migratedUser.passwordHash).toMatch(/^scrypt\$/);

    const migratedTicketId = ticketId;
    if (migratedTicketId === undefined) {
      throw new Error("Migration test Ticket was not created");
    }
    const migratedTicket = await prisma.ticket.findUniqueOrThrow({
      where: { id: migratedTicketId },
      select: { requesterUserId: true },
    });
    expect(migratedTicket.requesterUserId).toBe(migratedUser.id);
    expect(
      await prisma.attachment.count({ where: { ticketId: migratedTicketId } }),
    ).toBe(1);
    expect(await prisma.ticket.count()).toBe(countsBefore.tickets);
    expect(await prisma.attachment.count()).toBe(countsBefore.attachments);

    const migratedAgent = request.agent(app);
    const migratedLogin = await migratedAgent
      .post("/api/auth/login")
      .send({ email: credential.email, password: credential.initialPassword });
    expect(migratedLogin.status).toBe(200);
    expect(migratedLogin.body.user.mustChangePassword).toBe(true);

    const replacementPassword = `${randomUUID()}a1!`;
    const passwordChange = await migratedAgent
      .patch("/api/auth/password")
      .set("X-CSRF-Token", migratedLogin.body.csrfToken)
      .send({
        currentPassword: credential.initialPassword,
        newPassword: replacementPassword,
        confirmPassword: replacementPassword,
      });
    expect(passwordChange.status).toBe(200);
    expect(passwordChange.body.user.mustChangePassword).toBe(false);

    const migratedTicketResponse = await migratedAgent.get(
      `/api/tickets/${migratedTicketId}`,
    );
    expect(migratedTicketResponse.status).toBe(200);
    expect(migratedTicketResponse.body).toEqual(
      expect.objectContaining({
        id: migratedTicketId,
        requester: {
          id: migratedUser.id,
          name: "Migrated Regression Requester",
        },
      }),
    );

    const migratedAttachments = await migratedAgent.get(
      `/api/tickets/${migratedTicketId}/attachments`,
    );
    expect(migratedAttachments.status).toBe(200);
    expect(migratedAttachments.body).toEqual([
      expect.objectContaining({
        id: attachmentId,
        displayName: "migration-evidence.pdf",
        isActive: true,
      }),
    ]);

    const downloaded = await migratedAgent.get(
      `/api/tickets/${migratedTicketId}/attachments/${attachmentId}/download`,
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toMatch(/application\/pdf/);
    expect(downloaded.body).toEqual(Buffer.from("migration attachment"));

    await prisma.user.update({
      where: { email: "requester-a@toktickit.test" },
      data: {
        passwordHash: await hashPassword(lab3TestPassword),
        mustChangePassword: false,
      },
    });
    const otherRequester = request.agent(app);
    const otherLogin = await otherRequester.post("/api/auth/login").send({
      email: "requester-a@toktickit.test",
      password: lab3TestPassword,
    });
    expect(otherLogin.status).toBe(200);
    const deniedTicket = await otherRequester.get(
      `/api/tickets/${migratedTicketId}`,
    );
    const deniedAttachments = await otherRequester.get(
      `/api/tickets/${migratedTicketId}/attachments`,
    );
    expectError(deniedTicket, 404, "TICKET_NOT_FOUND");
    expectError(deniedAttachments, 404, "TICKET_NOT_FOUND");

    const secondHandoffRelativePath = `${handoffRelativePath}.second`;
    const second = await runMigration(secondHandoffRelativePath);
    const secondHandoff = JSON.parse(
      await readFile(
        resolve(repositoryRoot, secondHandoffRelativePath),
        "utf8",
      ),
    ) as Handoff;
    expect(secondHandoff.users).toEqual([]);
    expect(second.stdout).toContain("Migrated 0 new User credential(s)");
    expect(await prisma.user.count()).toBe(countsBefore.users + 1);
    expect(await prisma.ticket.count()).toBe(countsBefore.tickets);
    expect(await prisma.attachment.count()).toBe(countsBefore.attachments);
  });
});
