ALTER TABLE "Ticket"
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "lastReopenedAt" TIMESTAMP(3);

UPDATE "Ticket"
SET "resolvedAt" = "updatedAt"
WHERE "currentStatus" IN ('RESOLVED', 'CLOSED');

UPDATE "Ticket"
SET "lastReopenedAt" = "updatedAt"
WHERE "currentStatus" = 'REOPENED';

CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "actionDescription" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "performedByUserId" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "idempotencyKey" UUID NOT NULL,
    "requestFingerprint" BYTEA NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActionTaken_version_check" CHECK ("version" > 0),
    CONSTRAINT "ActionTaken_requestFingerprint_length_check" CHECK (octet_length("requestFingerprint") = 32)
);

CREATE UNIQUE INDEX "ActionTaken_idempotencyKey_key"
ON "ActionTaken"("idempotencyKey");

CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx"
ON "ActionTaken"("ticketId", "actionAt", "id");

CREATE INDEX "ActionTaken_ticketId_createdAt_idx"
ON "ActionTaken"("ticketId", "createdAt");

CREATE INDEX "ActionTaken_performedByUserId_createdAt_id_idx"
ON "ActionTaken"("performedByUserId", "createdAt", "id");

ALTER TABLE "ActionTaken"
ADD CONSTRAINT "ActionTaken_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionTaken"
ADD CONSTRAINT "ActionTaken_performedByUserId_fkey"
FOREIGN KEY ("performedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActionTaken"
ADD CONSTRAINT "ActionTaken_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
