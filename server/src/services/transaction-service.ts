import { Prisma } from "@prisma/client";

/**
 * User eligibility and Ticket ownership are one concurrency boundary. Every
 * operation that can change either side must use this lock and serializable
 * isolation so a stale eligibility check cannot commit alongside a conflicting
 * ownership change.
 */
export const serializableTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

const userOwnershipLockKey = 2026091701;

export async function acquireUserOwnershipLock(
  transaction: Pick<Prisma.TransactionClient, "$executeRaw">,
) {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(${userOwnershipLockKey})
  `;
}
