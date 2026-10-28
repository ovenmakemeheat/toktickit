import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import type { TicketStatus } from "@prisma/client";

import { removeE2eAttachment } from "../support/attachment-storage.js";
import { prisma } from "../../server/src/db.js";

export type SeededRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export type SeededSession = {
  user: {
    id: number;
    name: string;
    email: string;
    role: SeededRole;
    active: boolean;
    mustChangePassword: boolean;
  };
  csrfToken: string;
};

export async function loginSeededUser(
  page: Page,
  email: string,
  role: SeededRole,
): Promise<SeededSession> {
  const initialPassword =
    process.env.LAB3_TEST_PASSWORD ?? process.env.LAB3_SEED_PASSWORD;
  if (!initialPassword) {
    throw new Error(
      "LAB3_SEED_PASSWORD must be loaded from server/.env for seeded release journeys.",
    );
  }
  const replacementPassword = `${initialPassword.slice(0, 100)}Lab3E2E!9`;

  for (const password of [initialPassword, replacementPassword]) {
    const login = await page.request.post("/api/auth/login", {
      data: { email, password },
    });
    if (!login.ok()) {
      continue;
    }

    let session = (await login.json()) as SeededSession;
    if (session.user.mustChangePassword) {
      const changed = await page.request.patch("/api/auth/password", {
        data: {
          currentPassword: password,
          newPassword: replacementPassword,
          confirmPassword: replacementPassword,
        },
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      expect(changed.ok()).toBe(true);
      const current = await page.request.get("/api/auth/me");
      expect(current.ok()).toBe(true);
      session = (await current.json()) as SeededSession;
    }

    expect(session.user).toMatchObject({ email, role, active: true });
    expect(session.user.mustChangePassword).toBe(false);
    return session;
  }

  throw new Error(
    `Unable to authenticate seeded User ${email}; reset the isolated E2E database with bun run db:test:setup.`,
  );
}

export async function createSeededTicket(options: {
  requesterEmail: string;
  ownerEmail?: string | null;
  status: TicketStatus;
}) {
  const [requester, owner, category, relatedSystem] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: options.requesterEmail },
      select: { id: true },
    }),
    options.ownerEmail
      ? prisma.user.findUniqueOrThrow({
          where: { email: options.ownerEmail },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.category.findUniqueOrThrow({
      where: { name: "Software" },
      select: { id: true },
    }),
    prisma.relatedSystem.findUniqueOrThrow({
      where: { name: "Email" },
      select: { id: true },
    }),
  ]);
  const now = new Date();
  const marker = randomUUID().slice(0, 8).toUpperCase();
  return prisma.ticket.create({
    data: {
      ticketNumber: `TT-L4E2E-${marker}`,
      clientRequestId: randomUUID(),
      ticketDate: now,
      requesterUserId: requester.id,
      primaryOwnerUserId: owner?.id ?? null,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: options.status,
      lastReopenedAt: options.status === "REOPENED" ? now : null,
      summary: `Lab 4 seeded E2E ${marker}`,
      description: "Temporary isolated release-journey fixture.",
      updatedAt: now,
    },
    select: {
      id: true,
      ticketNumber: true,
      requesterUserId: true,
      primaryOwnerUserId: true,
      currentStatus: true,
      updatedAt: true,
      resolvedAt: true,
    },
  });
}

export async function cleanupSeededTicket(ticketId: number) {
  const attachments = await prisma.attachment.findMany({
    where: { ticketId },
    select: { storageKey: true },
  });
  await Promise.all(
    attachments.map(({ storageKey }) =>
      removeE2eAttachment(storageKey).catch(() => undefined),
    ),
  );
  await prisma.actionTaken.deleteMany({ where: { ticketId } });
  await prisma.attachment.deleteMany({ where: { ticketId } });
  await prisma.publicComment.deleteMany({ where: { ticketId } });
  await prisma.internalNote.deleteMany({ where: { ticketId } });
  await prisma.ticket.deleteMany({ where: { id: ticketId } });
}

export { prisma };
