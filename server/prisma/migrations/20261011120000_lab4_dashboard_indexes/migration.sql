CREATE INDEX "Ticket_requesterUserId_currentStatus_resolvedAt_id_idx"
ON "Ticket"("requesterUserId", "currentStatus", "resolvedAt", "id");

CREATE INDEX "Ticket_currentStatus_updatedAt_id_idx"
ON "Ticket"("currentStatus", "updatedAt", "id");
