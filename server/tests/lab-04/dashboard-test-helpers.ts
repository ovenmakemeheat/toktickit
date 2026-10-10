import { randomBytes, randomUUID } from "node:crypto";

import type { Role, TicketStatus } from "@prisma/client";

import {
  deleteTickets,
  lab3TestPassword,
  loginAgent,
  prisma,
} from "../lab-03/test-helpers.js";
import { hashPassword } from "../../src/services/password-service.js";

export async function createDashboardUser(role: Role) {
  const email = `lab4-dashboard-${randomUUID()}@toktickit.test`;
  const passwordHash = await hashPassword(lab3TestPassword);
  const user = await prisma.user.create({
    data: {
      name: `Lab 4 ${role} Dashboard User`,
      email,
      role,
      passwordHash,
      active: true,
      mustChangePassword: false,
    },
    select: { id: true, email: true },
  });
  return { ...user, ...(await loginAgent(email)) };
}

export async function createDashboardTicket(options: {
  requesterUserId: number;
  ownerUserId?: number | null;
  status: TicketStatus;
  itPriority?: "LOW" | "MEDIUM" | "HIGH";
  updatedAt: Date;
  resolvedAt?: Date | null;
}) {
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ select: { id: true } }),
    prisma.relatedSystem.findFirstOrThrow({ select: { id: true } }),
  ]);
  return prisma.ticket.create({
    data: {
      ticketNumber: `TT-DASH-${randomUUID().slice(0, 8).toUpperCase()}`,
      clientRequestId: randomUUID(),
      ticketDate: options.updatedAt,
      requesterUserId: options.requesterUserId,
      primaryOwnerUserId: options.ownerUserId ?? null,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "MEDIUM",
      itPriority: options.itPriority ?? "MEDIUM",
      currentStatus: options.status,
      summary: `Dashboard summary ${randomUUID().slice(0, 8)}`,
      description: "Dashboard fixture description must not be returned.",
      resolvedAt: options.resolvedAt ?? null,
      updatedAt: options.updatedAt,
    },
    select: { id: true, ticketNumber: true, summary: true },
  });
}

export async function createDashboardAction(options: {
  ticketId: number;
  performedByUserId: number;
  createdAt: Date;
}) {
  return prisma.actionTaken.create({
    data: {
      ticketId: options.ticketId,
      actionAt: options.createdAt,
      actionDescription: `Action summary ${randomUUID().slice(0, 8)}`,
      result: "Dashboard action result.",
      performedByUserId: options.performedByUserId,
      followUpRequired: true,
      followUpNote: "Private follow-up must not appear on dashboard.",
      attachmentNotes: "Private attachment notes must not appear on dashboard.",
      idempotencyKey: randomUUID(),
      requestFingerprint: randomBytes(32),
      version: 1,
      createdAt: options.createdAt,
      updatedAt: options.createdAt,
    },
    select: { id: true },
  });
}

export async function cleanDashboardFixtures(options: {
  ticketIds: number[];
  userIds: number[];
}) {
  await deleteTickets(options.ticketIds);
  if (options.userIds.length > 0) {
    await prisma.session.deleteMany({
      where: { userId: { in: options.userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: options.userIds } } });
  }
}
