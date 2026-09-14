import type {
  PrismaClient,
  RequestedPriority,
  Role,
  TicketStatus,
} from "@prisma/client";

import { seedCategories } from "./seed-categories.js";
import {
  developmentRequesters,
  relatedSystemNames,
  seedDevelopmentRequesters,
  seedRelatedSystems,
} from "./seed-reference-data.js";
import {
  hashPassword,
  validatePassword,
} from "../src/services/password-service.js";
import {
  ensureRequesterOwnershipConstraint,
  validateRequesterOwnershipConstraint,
} from "../src/services/ticket-ownership-service.js";

export const lab3SeedUsers = [
  {
    key: "requester-a",
    name: "Requester A",
    email: "requester-a@toktickit.test",
    role: "REQUESTER" as const,
    active: true,
    legacyEmail: "requester-a@toktickit.test",
  },
  {
    key: "requester-b",
    name: "Requester B",
    email: "requester-b@toktickit.test",
    role: "REQUESTER" as const,
    active: true,
    legacyEmail: "requester-b@toktickit.test",
  },
  {
    key: "requester-c",
    name: "Requester C",
    email: "requester-c@toktickit.test",
    role: "REQUESTER" as const,
    active: true,
    legacyEmail: "requester-c@toktickit.test",
  },
  {
    key: "requester-d",
    name: "Requester D",
    email: "requester-d@toktickit.test",
    role: "REQUESTER" as const,
    active: true,
    legacyEmail: "requester-d@toktickit.test",
  },
  {
    key: "inactive-requester",
    name: "Inactive Requester",
    email: "inactive-requester@toktickit.test",
    role: "REQUESTER" as const,
    active: false,
    legacyEmail: "inactive-requester@toktickit.test",
  },
  {
    key: "it-staff-a",
    name: "IT Staff A",
    email: "it-staff-a@toktickit.test",
    role: "IT_STAFF" as const,
    active: true,
  },
  {
    key: "it-staff-b",
    name: "IT Staff B",
    email: "it-staff-b@toktickit.test",
    role: "IT_STAFF" as const,
    active: true,
  },
  {
    key: "it-staff-c",
    name: "IT Staff C",
    email: "it-staff-c@toktickit.test",
    role: "IT_STAFF" as const,
    active: true,
  },
  {
    key: "inactive-it-staff",
    name: "Inactive IT Staff",
    email: "inactive-it-staff@toktickit.test",
    role: "IT_STAFF" as const,
    active: false,
  },
  {
    key: "administrator",
    name: "Administrator",
    email: "administrator@toktickit.test",
    role: "ADMINISTRATOR" as const,
    active: true,
  },
] as const;

const seedTicketFixtures = [
  {
    clientRequestId: "00000000-0000-4000-8000-000000000001",
    ticketNumber: "TT-20260910-SEED01",
    requesterKey: "requester-a",
    category: "Software",
    relatedSystem: "Email",
    requestedPriority: "HIGH" as const,
    itPriority: "HIGH" as const,
    currentStatus: "NEW" as const,
    primaryOwnerKey: undefined,
    summary: "Cannot access course email",
    description: "The browser shows an authentication error after sign-in.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000002",
    ticketNumber: "TT-20260910-SEED02",
    requesterKey: "requester-b",
    category: "Network",
    relatedSystem: "VPN",
    requestedPriority: "MEDIUM" as const,
    itPriority: "HIGH" as const,
    currentStatus: "OPEN" as const,
    primaryOwnerKey: "it-staff-a",
    summary: "VPN connection fails",
    description: "The VPN connection fails after entering the credentials.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000003",
    ticketNumber: "TT-20260910-SEED03",
    requesterKey: "requester-c",
    category: "Hardware",
    relatedSystem: "Corporate Laptop",
    requestedPriority: "LOW" as const,
    itPriority: "LOW" as const,
    currentStatus: "IN_PROGRESS" as const,
    primaryOwnerKey: "it-staff-b",
    summary: "Laptop battery drains quickly",
    description: "The laptop battery reaches zero during a normal morning.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000004",
    ticketNumber: "TT-20260910-SEED04",
    requesterKey: "requester-d",
    category: "Account and Access",
    relatedSystem: "LEB2 App",
    requestedPriority: "HIGH" as const,
    itPriority: "MEDIUM" as const,
    currentStatus: "WAITING_FOR_REQUESTER" as const,
    primaryOwnerKey: "it-staff-c",
    summary: "Course access request is pending",
    description: "The course workspace still reports that access is pending.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000005",
    ticketNumber: "TT-20260910-SEED05",
    requesterKey: "requester-a",
    category: "Software",
    relatedSystem: "Grade Submission App",
    requestedPriority: "MEDIUM" as const,
    itPriority: "MEDIUM" as const,
    currentStatus: "RESOLVED" as const,
    primaryOwnerKey: "it-staff-a",
    summary: "Grade submission form is available again",
    description: "The grade form stopped loading but now opens successfully.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000006",
    ticketNumber: "TT-20260910-SEED06",
    requesterKey: "requester-b",
    category: "Hardware",
    relatedSystem: "Printer",
    requestedPriority: "LOW" as const,
    itPriority: "LOW" as const,
    currentStatus: "CLOSED" as const,
    primaryOwnerKey: "administrator",
    summary: "Printer queue was cleared",
    description: "The shared printer queue was cleared and printing resumed.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000007",
    ticketNumber: "TT-20260910-SEED07",
    requesterKey: "requester-c",
    category: "Network",
    relatedSystem: "Campus Wi-Fi",
    requestedPriority: "HIGH" as const,
    itPriority: "HIGH" as const,
    currentStatus: "REOPENED" as const,
    primaryOwnerKey: "it-staff-b",
    summary: "Campus Wi-Fi disconnected again",
    description: "The campus Wi-Fi disconnects again after a short period.",
  },
  {
    clientRequestId: "00000000-0000-4000-8000-000000000008",
    ticketNumber: "TT-20260910-SEED08",
    requesterKey: "requester-d",
    category: "Account and Access",
    relatedSystem: "Email",
    requestedPriority: "MEDIUM" as const,
    itPriority: "MEDIUM" as const,
    currentStatus: "CANCELLED" as const,
    primaryOwnerKey: "it-staff-c",
    summary: "Duplicate mailbox request",
    description: "This request duplicated an existing mailbox request.",
  },
] as const;

function requireSeedPassword(password: string | undefined) {
  if (!password || validatePassword(password)) {
    throw new Error(
      "LAB3_SEED_PASSWORD must satisfy the documented password policy",
    );
  }
  return password;
}

async function upsertUsers(prisma: PrismaClient, password: string) {
  const passwordHash = await hashPassword(password);
  const legacyRequesters = await prisma.developmentRequester.findMany({
    select: { id: true, email: true },
  });
  const legacyIds = new Map(
    legacyRequesters.map((requester) => [
      requester.email.toLowerCase(),
      requester.id,
    ]),
  );
  const users = new Map<string, { id: number; role: Role; active: boolean }>();

  for (const fixture of lab3SeedUsers) {
    const legacyDevelopmentRequesterId =
      "legacyEmail" in fixture ? legacyIds.get(fixture.legacyEmail) : undefined;
    const existing = await prisma.user.findUnique({
      where: { email: fixture.email },
      select: { id: true, role: true, active: true },
    });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: fixture.name,
            role: fixture.role,
            active: fixture.active,
            ...(legacyDevelopmentRequesterId === undefined
              ? {}
              : { legacyDevelopmentRequesterId }),
          },
          select: { id: true, role: true, active: true },
        })
      : await prisma.user.create({
          data: {
            name: fixture.name,
            email: fixture.email,
            role: fixture.role,
            passwordHash,
            active: fixture.active,
            mustChangePassword: true,
            legacyDevelopmentRequesterId,
          },
          select: { id: true, role: true, active: true },
        });
    users.set(fixture.key, user);
  }

  return users;
}

async function backfillRequesterOwnership(prisma: PrismaClient) {
  const requesters = await prisma.developmentRequester.findMany({
    select: { id: true, email: true },
  });
  for (const requester of requesters) {
    const user = await prisma.user.findUnique({
      where: { email: requester.email.toLowerCase() },
      select: { id: true, role: true },
    });
    if (user?.role !== "REQUESTER") {
      continue;
    }

    const conflicting = await prisma.ticket.findFirst({
      where: {
        requesterId: requester.id,
        requesterUserId: { not: user.id },
      },
      select: { id: true },
    });
    if (conflicting) {
      throw new Error(
        `Conflicting requester ownership for Ticket ${conflicting.id}`,
      );
    }

    await prisma.ticket.updateMany({
      where: { requesterId: requester.id, requesterUserId: null },
      data: { requesterUserId: user.id },
    });
  }
}

async function upsertSeedTickets(
  prisma: PrismaClient,
  users: Map<string, { id: number }>,
) {
  const categories = await prisma.category.findMany({
    where: {
      name: {
        in: [...new Set(seedTicketFixtures.map((ticket) => ticket.category))],
      },
    },
    select: { id: true, name: true },
  });
  const systems = await prisma.relatedSystem.findMany({
    where: {
      name: {
        in: [
          ...new Set(seedTicketFixtures.map((ticket) => ticket.relatedSystem)),
        ],
      },
    },
    select: { id: true, name: true },
  });
  const categoryIds = new Map(
    categories.map((category) => [category.name, category.id]),
  );
  const systemIds = new Map(systems.map((system) => [system.name, system.id]));
  const ticketDate = new Date("2026-09-10T10:30:00.000Z");

  for (const fixture of seedTicketFixtures) {
    const requester = users.get(fixture.requesterKey);
    const categoryId = categoryIds.get(fixture.category);
    const relatedSystemId = systemIds.get(fixture.relatedSystem);
    if (!requester || !categoryId || !relatedSystemId) {
      throw new Error(`Unable to resolve seed Ticket ${fixture.ticketNumber}`);
    }
    const owner = fixture.primaryOwnerKey
      ? users.get(fixture.primaryOwnerKey)?.id
      : undefined;
    const existing = await prisma.ticket.findUnique({
      where: { clientRequestId: fixture.clientRequestId },
      select: { id: true },
    });
    if (existing) {
      await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          requesterUserId: requester.id,
          categoryId,
          relatedSystemId,
          requestedPriority: fixture.requestedPriority,
          itPriority: fixture.itPriority,
          currentStatus: fixture.currentStatus,
          primaryOwnerUserId: owner ?? null,
          summary: fixture.summary,
          description: fixture.description,
        },
      });
      continue;
    }

    await prisma.ticket.create({
      data: {
        ticketNumber: fixture.ticketNumber,
        clientRequestId: fixture.clientRequestId,
        ticketDate,
        requesterUserId: requester.id,
        requestedPriority: fixture.requestedPriority,
        itPriority: fixture.itPriority,
        currentStatus: fixture.currentStatus,
        primaryOwnerUserId: owner ?? null,
        categoryId,
        relatedSystemId,
        summary: fixture.summary,
        description: fixture.description,
      },
    });
  }
}

async function enforceRequesterOwnershipConstraint(prisma: PrismaClient) {
  await ensureRequesterOwnershipConstraint(prisma);
  const orphanedTicket = await prisma.ticket.findFirst({
    where: { requesterUserId: null },
    select: { id: true },
  });
  if (orphanedTicket) {
    throw new Error(
      `Ticket ${orphanedTicket.id} has no authenticated Requester User`,
    );
  }

  await validateRequesterOwnershipConstraint(prisma);
}

async function upsertSeedCommunication(
  prisma: PrismaClient,
  users: Map<string, { id: number }>,
) {
  const ticket = await prisma.ticket.findUnique({
    where: { clientRequestId: "00000000-0000-4000-8000-000000000002" },
    select: { id: true },
  });
  const staff = users.get("it-staff-a");
  const requester = users.get("requester-b");
  if (!ticket || !staff || !requester) {
    return;
  }

  const publicComment = "Please try the documented browser sign-in again.";
  const internalNote =
    "Seed note: verify the identity provider response before escalation.";
  if (
    !(await prisma.publicComment.findFirst({
      where: {
        ticketId: ticket.id,
        authorUserId: staff.id,
        content: publicComment,
      },
      select: { id: true },
    }))
  ) {
    await prisma.publicComment.create({
      data: {
        ticketId: ticket.id,
        authorUserId: staff.id,
        content: publicComment,
      },
    });
  }
  if (
    !(await prisma.internalNote.findFirst({
      where: {
        ticketId: ticket.id,
        authorUserId: staff.id,
        content: internalNote,
      },
      select: { id: true },
    }))
  ) {
    await prisma.internalNote.create({
      data: {
        ticketId: ticket.id,
        authorUserId: staff.id,
        content: internalNote,
      },
    });
  }
  if (
    !(await prisma.publicComment.findFirst({
      where: {
        ticketId: ticket.id,
        authorUserId: requester.id,
        content: "I can sign in now, thank you.",
      },
      select: { id: true },
    }))
  ) {
    await prisma.publicComment.create({
      data: {
        ticketId: ticket.id,
        authorUserId: requester.id,
        content: "I can sign in now, thank you.",
      },
    });
  }
}

export async function seedLab3Data(
  prisma: PrismaClient,
  password: string | undefined,
) {
  const seedPassword = requireSeedPassword(password);
  await seedCategories(prisma);
  await seedRelatedSystems(prisma);
  await seedDevelopmentRequesters(prisma);
  const users = await upsertUsers(prisma, seedPassword);
  await backfillRequesterOwnership(prisma);
  await upsertSeedTickets(prisma, users);
  await upsertSeedCommunication(prisma, users);
  await enforceRequesterOwnershipConstraint(prisma);
}

export { developmentRequesters, relatedSystemNames };
export type { RequestedPriority, Role, TicketStatus };
