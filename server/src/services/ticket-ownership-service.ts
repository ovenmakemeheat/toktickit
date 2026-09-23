import type { PrismaClient } from "@prisma/client";

type RawSqlStore = Pick<PrismaClient, "$executeRawUnsafe">;

export const requesterOwnershipForeignKeyName = "Ticket_requesterUserId_fkey";
export const requesterOwnershipConstraintName =
  "Ticket_requesterUserId_not_null";

export async function ensureRequesterOwnershipConstraint(prisma: RawSqlStore) {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = '${requesterOwnershipForeignKeyName}'
          AND conrelid = '"Ticket"'::regclass
          AND confdeltype = 'r'
      ) THEN
        ALTER TABLE "Ticket"
          DROP CONSTRAINT IF EXISTS "${requesterOwnershipForeignKeyName}";
        ALTER TABLE "Ticket"
          ADD CONSTRAINT "${requesterOwnershipForeignKeyName}"
          FOREIGN KEY ("requesterUserId") REFERENCES "User"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = '${requesterOwnershipConstraintName}'
          AND conrelid = '"Ticket"'::regclass
      ) THEN
        ALTER TABLE "Ticket"
          ADD CONSTRAINT "${requesterOwnershipConstraintName}"
          CHECK ("requesterUserId" IS NOT NULL) NOT VALID;
      END IF;
    END
    $$;
  `);
}

export async function validateRequesterOwnershipConstraint(
  prisma: RawSqlStore,
) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Ticket" VALIDATE CONSTRAINT "${requesterOwnershipConstraintName}"`,
  );
}
