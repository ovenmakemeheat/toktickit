-- Preserve nullable Ticket rows until the Lab 3 data migration backfills legacy ownership.
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterUserId_fkey";
ALTER TABLE "Ticket" ALTER COLUMN "requesterUserId" DROP NOT NULL;

-- Requester ownership is mandatory after migration and must not be nulled by User deletion.
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- NOT VALID permits existing Lab 2 rows to be backfilled by migrate-lab3.ts.
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterUserId_not_null"
  CHECK ("requesterUserId" IS NOT NULL) NOT VALID;
