import { execFile as callbackExecFile } from "node:child_process";
import { copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { seedLab3Data } from "../../prisma/seed-lab3-data.js";
import {
  getRequesterDashboard,
  getStaffDashboard,
} from "../../src/services/dashboard-service.js";
import { lab3TestPassword, prisma } from "../lab-03/test-helpers.js";

const execFile = promisify(callbackExecFile);
const testFilePath = fileURLToPath(import.meta.url);
const serverRoot = resolve(dirname(testFilePath), "../..");
const migrationRoot = resolve(serverRoot, "prisma/migrations");
const prismaCommand = resolve(
  serverRoot,
  "node_modules/.bin",
  process.platform === "win32" ? "prisma.exe" : "prisma",
);
const preLab4Migrations = [
  "20260805160550_add_category",
  "20260824091500_add_lab2_requester_context",
  "20260913073929_lab3_authentication",
  "20260914140000_enforce_requester_ticket_ownership",
] as const;
const fixtureIds = {
  requester: 88_001,
  staff: 88_002,
  administrator: 88_003,
  category: 88_001,
  relatedSystem: 88_001,
  openTicket: 88_001,
  resolvedTicket: 88_002,
  closedTicket: 88_003,
  reopenedTicket: 88_004,
  attachment: 88_001,
  publicComment: 88_001,
  internalNote: 88_001,
} as const;

type PersistedCounts = {
  users: number;
  tickets: number;
  attachments: number;
  publicComments: number;
  internalNotes: number;
  actionsTaken: number;
};

function schemaScopedUrl(baseUrl: string, schemaName: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

async function runPrisma(
  configPath: string,
  databaseUrl: string,
  args: string[],
) {
  return execFile(prismaCommand, [...args, "--config", configPath], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    maxBuffer: 1024 * 1024,
    timeout: 120_000,
  });
}

async function persistCounts(client: PrismaClient): Promise<PersistedCounts> {
  const [
    users,
    tickets,
    attachments,
    publicComments,
    internalNotes,
    actionsTaken,
  ] = await Promise.all([
    client.user.count(),
    client.ticket.count(),
    client.attachment.count(),
    client.publicComment.count(),
    client.internalNote.count(),
    client.actionTaken.count(),
  ]);
  return {
    users,
    tickets,
    attachments,
    publicComments,
    internalNotes,
    actionsTaken,
  };
}

async function createLab3Baseline(client: PrismaClient) {
  await client.$executeRawUnsafe(`
    INSERT INTO "Category" ("id", "name", "active", "createdAt")
    VALUES (${fixtureIds.category}, 'Migration Regression', true, '2026-08-01T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "RelatedSystem" ("id", "name", "active", "createdAt", "updatedAt")
    VALUES (${fixtureIds.relatedSystem}, 'Migration Test System', true, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "User" (
      "id", "name", "email", "role", "passwordHash", "active",
      "mustChangePassword", "legacyDevelopmentRequesterId", "createdAt", "updatedAt"
    )
    VALUES
      (${fixtureIds.requester}, 'Migration Requester', 'migration-requester@toktickit.test', 'REQUESTER', 'fixture-hash-not-used', true, false, NULL, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      (${fixtureIds.staff}, 'Migration IT Staff', 'migration-staff@toktickit.test', 'IT_STAFF', 'fixture-hash-not-used', true, false, NULL, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      (${fixtureIds.administrator}, 'Migration Administrator', 'migration-admin@toktickit.test', 'ADMINISTRATOR', 'fixture-hash-not-used', true, false, NULL, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "Ticket" (
      "id", "ticketNumber", "clientRequestId", "ticketDate", "requesterId",
      "requesterUserId", "primaryOwnerUserId", "categoryId", "relatedSystemId",
      "requestedPriority", "itPriority", "summary", "description", "currentStatus",
      "createdAt", "updatedAt"
    )
    VALUES
      (${fixtureIds.openTicket}, 'TT-MIGRATION-OPEN', '88000000-0000-4000-8000-000000000001', '2026-08-01T00:00:00.000Z', NULL, ${fixtureIds.requester}, ${fixtureIds.staff}, ${fixtureIds.category}, ${fixtureIds.relatedSystem}, 'HIGH', 'MEDIUM', 'Open legacy Ticket', 'Baseline Ticket row for additive migration.', 'OPEN', '2026-08-01T00:00:00.000Z', '2026-09-01T11:00:00.000Z'),
      (${fixtureIds.resolvedTicket}, 'TT-MIGRATION-RESOLVED', '88000000-0000-4000-8000-000000000002', '2026-08-02T00:00:00.000Z', NULL, ${fixtureIds.requester}, ${fixtureIds.staff}, ${fixtureIds.category}, ${fixtureIds.relatedSystem}, 'MEDIUM', 'MEDIUM', 'Resolved legacy Ticket', 'Resolved timestamp approximation baseline.', 'RESOLVED', '2026-08-02T00:00:00.000Z', '2026-08-20T12:00:00.000Z'),
      (${fixtureIds.closedTicket}, 'TT-MIGRATION-CLOSED', '88000000-0000-4000-8000-000000000003', '2026-08-03T00:00:00.000Z', NULL, ${fixtureIds.requester}, ${fixtureIds.administrator}, ${fixtureIds.category}, ${fixtureIds.relatedSystem}, 'LOW', 'LOW', 'Closed legacy Ticket', 'Closed timestamp approximation baseline.', 'CLOSED', '2026-08-03T00:00:00.000Z', '2026-08-21T12:00:00.000Z'),
      (${fixtureIds.reopenedTicket}, 'TT-MIGRATION-REOPENED', '88000000-0000-4000-8000-000000000004', '2026-08-04T00:00:00.000Z', NULL, ${fixtureIds.requester}, ${fixtureIds.staff}, ${fixtureIds.category}, ${fixtureIds.relatedSystem}, 'HIGH', 'HIGH', 'Reopened legacy Ticket', 'Reopen timestamp approximation baseline.', 'REOPENED', '2026-08-04T00:00:00.000Z', '2026-08-22T12:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "Attachment" (
      "id", "ticketId", "storageKey", "displayName", "mimeType", "sizeBytes", "uploadedAt"
    )
    VALUES (${fixtureIds.attachment}, ${fixtureIds.openTicket}, 'migration-regression-attachment', 'migration-evidence.pdf', 'application/pdf', 128, '2026-08-05T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "PublicComment" ("id", "ticketId", "authorUserId", "content", "createdAt")
    VALUES (${fixtureIds.publicComment}, ${fixtureIds.openTicket}, ${fixtureIds.staff}, 'Migration baseline public comment.', '2026-08-06T00:00:00.000Z')
  `);
  await client.$executeRawUnsafe(`
    INSERT INTO "InternalNote" ("id", "ticketId", "authorUserId", "content", "createdAt")
    VALUES (${fixtureIds.internalNote}, ${fixtureIds.openTicket}, ${fixtureIds.staff}, 'Migration baseline internal note.', '2026-08-06T00:01:00.000Z')
  `);
}

describe("Lab 4 additive migration and repeat-safe seed", () => {
  it("upgrades a Lab 3-shaped schema without losing rows and seeds without duplicates", async () => {
    const baseDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!baseDatabaseUrl) {
      throw new Error(
        "TEST_DATABASE_URL is required for migration verification.",
      );
    }
    const schemaName = `lab4_migration_${process.pid}_${randomUUID().replaceAll("-", "")}`;
    const databaseUrl = schemaScopedUrl(baseDatabaseUrl, schemaName);
    const temporaryRoot = resolve(
      serverRoot,
      ".local",
      `lab4-migration-${schemaName}`,
    );
    const temporaryMigrations = resolve(temporaryRoot, "migrations");
    const baselineConfig = resolve(temporaryRoot, "prisma.config.mjs");
    const currentConfig = resolve(serverRoot, "prisma.config.ts");
    const prismaSchema = resolve(serverRoot, "prisma/schema.prisma");
    const client = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    let schemaCreated = false;

    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
      schemaCreated = true;
      await mkdir(temporaryMigrations, { recursive: true });
      for (const migrationName of preLab4Migrations) {
        await cp(
          resolve(migrationRoot, migrationName),
          resolve(temporaryMigrations, migrationName),
          { recursive: true },
        );
      }
      await copyFile(
        resolve(migrationRoot, "migration_lock.toml"),
        resolve(temporaryMigrations, "migration_lock.toml"),
      );
      await writeFile(
        baselineConfig,
        [
          'import { defineConfig } from "prisma/config";',
          "export default defineConfig({",
          `  schema: ${JSON.stringify(prismaSchema)},`,
          `  migrations: { path: ${JSON.stringify(temporaryMigrations)} },`,
          '  datasource: { url: process.env.DATABASE_URL ?? "" },',
          "});",
          "",
        ].join("\n"),
        "utf8",
      );

      await runPrisma(baselineConfig, databaseUrl, ["migrate", "deploy"]);
      await client.$connect();
      await createLab3Baseline(client);

      const beforeCounts = {
        users: Number(
          (
            await client.$queryRawUnsafe<{ count: bigint }[]>(
              'SELECT COUNT(*) AS count FROM "User"',
            )
          )[0]?.count ?? 0,
        ),
        tickets: Number(
          (
            await client.$queryRawUnsafe<{ count: bigint }[]>(
              'SELECT COUNT(*) AS count FROM "Ticket"',
            )
          )[0]?.count ?? 0,
        ),
        attachments: Number(
          (
            await client.$queryRawUnsafe<{ count: bigint }[]>(
              'SELECT COUNT(*) AS count FROM "Attachment"',
            )
          )[0]?.count ?? 0,
        ),
        publicComments: Number(
          (
            await client.$queryRawUnsafe<{ count: bigint }[]>(
              'SELECT COUNT(*) AS count FROM "PublicComment"',
            )
          )[0]?.count ?? 0,
        ),
        internalNotes: Number(
          (
            await client.$queryRawUnsafe<{ count: bigint }[]>(
              'SELECT COUNT(*) AS count FROM "InternalNote"',
            )
          )[0]?.count ?? 0,
        ),
      };
      expect(beforeCounts).toEqual({
        users: 3,
        tickets: 4,
        attachments: 1,
        publicComments: 1,
        internalNotes: 1,
      });

      await runPrisma(currentConfig, databaseUrl, ["migrate", "deploy"]);
      const openTicket = await client.ticket.findUniqueOrThrow({
        where: { id: fixtureIds.openTicket },
        select: {
          id: true,
          requesterUserId: true,
          primaryOwnerUserId: true,
          currentStatus: true,
          updatedAt: true,
        },
      });
      expect(openTicket).toMatchObject({
        id: fixtureIds.openTicket,
        requesterUserId: fixtureIds.requester,
        primaryOwnerUserId: fixtureIds.staff,
        currentStatus: "OPEN",
        updatedAt: new Date("2026-09-01T11:00:00.000Z"),
      });

      const resolvedTicket = await client.ticket.findUniqueOrThrow({
        where: { id: fixtureIds.resolvedTicket },
        select: { currentStatus: true, updatedAt: true, resolvedAt: true },
      });
      expect(resolvedTicket.resolvedAt).toEqual(resolvedTicket.updatedAt);
      const closedTicket = await client.ticket.findUniqueOrThrow({
        where: { id: fixtureIds.closedTicket },
        select: { currentStatus: true, updatedAt: true, resolvedAt: true },
      });
      expect(closedTicket.resolvedAt).toEqual(closedTicket.updatedAt);
      const reopenedTicket = await client.ticket.findUniqueOrThrow({
        where: { id: fixtureIds.reopenedTicket },
        select: { currentStatus: true, updatedAt: true, lastReopenedAt: true },
      });
      expect(reopenedTicket.lastReopenedAt).toEqual(reopenedTicket.updatedAt);
      expect(
        await client.actionTaken.count({
          where: {
            ticketId: {
              in: [
                fixtureIds.openTicket,
                fixtureIds.resolvedTicket,
                fixtureIds.closedTicket,
                fixtureIds.reopenedTicket,
              ],
            },
          },
        }),
      ).toBe(0);

      expect(
        await client.attachment.findUniqueOrThrow({
          where: { id: fixtureIds.attachment },
          select: {
            id: true,
            ticketId: true,
            storageKey: true,
            displayName: true,
          },
        }),
      ).toEqual({
        id: fixtureIds.attachment,
        ticketId: fixtureIds.openTicket,
        storageKey: "migration-regression-attachment",
        displayName: "migration-evidence.pdf",
      });
      expect(
        await client.publicComment.findUniqueOrThrow({
          where: { id: fixtureIds.publicComment },
          select: {
            id: true,
            ticketId: true,
            authorUserId: true,
            content: true,
          },
        }),
      ).toMatchObject({
        id: fixtureIds.publicComment,
        ticketId: fixtureIds.openTicket,
        authorUserId: fixtureIds.staff,
        content: "Migration baseline public comment.",
      });
      expect(
        await client.internalNote.findUniqueOrThrow({
          where: { id: fixtureIds.internalNote },
          select: {
            id: true,
            ticketId: true,
            authorUserId: true,
            content: true,
          },
        }),
      ).toMatchObject({
        id: fixtureIds.internalNote,
        ticketId: fixtureIds.openTicket,
        authorUserId: fixtureIds.staff,
        content: "Migration baseline internal note.",
      });

      const afterMigrationCounts = await persistCounts(client);
      expect(afterMigrationCounts).toMatchObject({
        users: beforeCounts.users,
        tickets: beforeCounts.tickets,
        attachments: beforeCounts.attachments,
        publicComments: beforeCounts.publicComments,
        internalNotes: beforeCounts.internalNotes,
        actionsTaken: 0,
      });
      await runPrisma(currentConfig, databaseUrl, ["migrate", "deploy"]);
      expect(await persistCounts(client)).toEqual(afterMigrationCounts);

      await seedLab3Data(client, lab3TestPassword);
      const firstSeedCounts = await persistCounts(client);
      await seedLab3Data(client, lab3TestPassword);
      expect(await persistCounts(client)).toEqual(firstSeedCounts);

      const seedTickets = await client.ticket.findMany({
        where: { ticketNumber: { startsWith: "TT-20260910-SEED" } },
        select: {
          id: true,
          ticketNumber: true,
          currentStatus: true,
          requestedPriority: true,
          itPriority: true,
          primaryOwnerUserId: true,
        },
      });
      expect(seedTickets).toHaveLength(8);
      expect(
        new Set(seedTickets.map((ticket) => ticket.currentStatus)),
      ).toEqual(
        new Set([
          "NEW",
          "OPEN",
          "IN_PROGRESS",
          "WAITING_FOR_REQUESTER",
          "RESOLVED",
          "CLOSED",
          "REOPENED",
          "CANCELLED",
        ]),
      );
      expect(
        new Set(seedTickets.map((ticket) => ticket.requestedPriority)),
      ).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
      expect(new Set(seedTickets.map((ticket) => ticket.itPriority))).toEqual(
        new Set(["LOW", "MEDIUM", "HIGH"]),
      );
      expect(
        seedTickets.some((ticket) => ticket.primaryOwnerUserId === null),
      ).toBe(true);
      expect(
        seedTickets.some((ticket) => ticket.primaryOwnerUserId !== null),
      ).toBe(true);

      const seedActions = await client.actionTaken.findMany({
        where: {
          ticket: { ticketNumber: { startsWith: "TT-20260910-SEED" } },
        },
        select: {
          id: true,
          ticketId: true,
          followUpRequired: true,
          followUpNote: true,
          attachmentNotes: true,
          performedByUserId: true,
        },
      });
      const seedTicketByNumber = new Map(
        seedTickets.map((ticket) => [ticket.ticketNumber, ticket]),
      );
      const seed05 = seedTicketByNumber.get("TT-20260910-SEED05");
      const seed07 = seedTicketByNumber.get("TT-20260910-SEED07");
      expect(seed05).toBeDefined();
      expect(seed07).toBeDefined();
      expect(
        seedActions.filter((action) => action.ticketId === seed05?.id),
      ).toHaveLength(2);
      expect(
        seedActions.filter((action) => action.ticketId === seed07?.id),
      ).toHaveLength(1);
      expect(
        seedTickets.some(
          (ticket) =>
            ticket.ticketNumber === "TT-20260910-SEED01" &&
            !seedActions.some((action) => action.ticketId === ticket.id),
        ),
      ).toBe(true);
      expect(
        new Set(seedActions.map((action) => action.followUpRequired)),
      ).toEqual(new Set([false, true]));
      expect(
        seedActions.some(
          (action) =>
            action.ticketId === seed05?.id &&
            action.performedByUserId !== seed05.primaryOwnerUserId,
        ),
      ).toBe(true);
      expect(
        seedActions.some(
          (action) =>
            action.ticketId === seed05?.id &&
            action.attachmentNotes?.includes("existing service status"),
        ),
      ).toBe(true);

      const requesterA = await client.user.findUniqueOrThrow({
        where: { email: "requester-a@toktickit.test" },
        select: { id: true },
      });
      const requesterD = await client.user.findUniqueOrThrow({
        where: { email: "requester-d@toktickit.test" },
        select: { id: true },
      });
      const staffA = await client.user.findUniqueOrThrow({
        where: { email: "it-staff-a@toktickit.test" },
        select: { id: true },
      });
      const administrator = await client.user.findUniqueOrThrow({
        where: { email: "administrator@toktickit.test" },
        select: { id: true },
      });
      const requesterDashboard = await getRequesterDashboard(
        client,
        requesterA.id,
      );
      const requesterWithWaiting = await getRequesterDashboard(
        client,
        requesterD.id,
      );
      const staffDashboard = await getStaffDashboard(client, staffA.id);
      const administratorDashboard = await getStaffDashboard(
        client,
        administrator.id,
      );
      expect(requesterDashboard.metrics.openCount).toBeGreaterThan(0);
      expect(requesterDashboard.metrics.waitingForRequesterCount).toBe(0);
      expect(
        requesterWithWaiting.metrics.waitingForRequesterCount,
      ).toBeGreaterThan(0);
      expect(staffDashboard.metrics.myActiveCount).toBeGreaterThan(0);
      expect(administratorDashboard.metrics.myActiveCount).toBe(0);

      const preservedUsers = await client.user.findMany({
        where: { id: fixtureIds.requester },
        select: { id: true, email: true, role: true },
      });
      expect(preservedUsers).toEqual([
        {
          id: fixtureIds.requester,
          email: "migration-requester@toktickit.test",
          role: "REQUESTER",
        },
      ]);
    } finally {
      await client.$disconnect().catch(() => undefined);
      if (schemaCreated) {
        await prisma
          .$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
          .catch(() => undefined);
      }
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 120_000);
});
