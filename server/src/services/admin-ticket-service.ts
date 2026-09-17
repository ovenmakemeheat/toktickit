import type { PrismaClient } from "@prisma/client";

import {
  findStaffTicket,
  parseItPriority,
  toStaffTicketDetailCore,
  type StaffTicketDetailResponse,
} from "./staff-ticket-service.js";

/**
 * The Administrator Ticket Review is a read-only detail lookup. It shares the
 * Ticket detail mapping with the IT Staff view but never exposes assignment
 * targets, because an Administrator has no Queue, claim, reassign, status,
 * Public Comment, or Internal Note creation permission.
 */
export type AdminTicketDetailResponse = Omit<
  StaffTicketDetailResponse,
  "eligibleOwners"
>;

type AdminTicketStore = Pick<PrismaClient, "ticket">;

export async function getAdminTicketDetail(
  prisma: AdminTicketStore,
  rawTicketId: unknown,
): Promise<AdminTicketDetailResponse> {
  const ticket = await findStaffTicket(prisma, rawTicketId);
  return toStaffTicketDetailCore(ticket);
}

export async function updateAdminTicketPriority(
  prisma: AdminTicketStore,
  rawTicketId: unknown,
  rawBody: unknown,
): Promise<AdminTicketDetailResponse> {
  const ticket = await findStaffTicket(prisma, rawTicketId);
  const itPriority = parseItPriority(rawBody);
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { itPriority },
  });
  return getAdminTicketDetail(prisma, ticket.id);
}
