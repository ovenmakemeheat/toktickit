import type { TicketStatus } from "@prisma/client";

const statusValues = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const satisfies readonly TicketStatus[];

type TransitionRule = {
  confirmationRequired: boolean;
};

const transitionRules: Record<
  TicketStatus,
  Partial<Record<TicketStatus, TransitionRule>>
> = {
  NEW: {
    OPEN: { confirmationRequired: false },
    CANCELLED: { confirmationRequired: true },
  },
  OPEN: {
    IN_PROGRESS: { confirmationRequired: false },
    WAITING_FOR_REQUESTER: { confirmationRequired: false },
    RESOLVED: { confirmationRequired: true },
    CANCELLED: { confirmationRequired: true },
  },
  IN_PROGRESS: {
    OPEN: { confirmationRequired: false },
    WAITING_FOR_REQUESTER: { confirmationRequired: false },
    RESOLVED: { confirmationRequired: true },
    CANCELLED: { confirmationRequired: true },
  },
  WAITING_FOR_REQUESTER: {
    OPEN: { confirmationRequired: false },
    IN_PROGRESS: { confirmationRequired: false },
    RESOLVED: { confirmationRequired: true },
    CANCELLED: { confirmationRequired: true },
  },
  RESOLVED: {
    CLOSED: { confirmationRequired: true },
    REOPENED: { confirmationRequired: true },
  },
  CLOSED: {
    REOPENED: { confirmationRequired: true },
  },
  REOPENED: {
    OPEN: { confirmationRequired: false },
    IN_PROGRESS: { confirmationRequired: false },
    WAITING_FOR_REQUESTER: { confirmationRequired: false },
    RESOLVED: { confirmationRequired: true },
    CANCELLED: { confirmationRequired: true },
  },
  CANCELLED: {
    REOPENED: { confirmationRequired: true },
  },
};

export class TicketStatusTransitionInvalidError extends Error {
  readonly code = "TICKET_STATUS_TRANSITION_INVALID";

  constructor() {
    super("The requested Ticket status transition is not allowed");
    this.name = "TicketStatusTransitionInvalidError";
  }
}

export class StatusConfirmationRequiredError extends Error {
  readonly code = "STATUS_CONFIRMATION_REQUIRED";

  constructor() {
    super("This Ticket status transition requires confirmation");
    this.name = "StatusConfirmationRequiredError";
  }
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === "string" &&
    (statusValues as readonly string[]).includes(value)
  );
}

export function parseTicketStatus(value: unknown): TicketStatus {
  if (!isTicketStatus(value)) {
    throw new TicketStatusTransitionInvalidError();
  }
  return value;
}

export function assertAllowedStatusTransition(
  from: TicketStatus,
  to: TicketStatus,
  confirmation: unknown,
) {
  const rule = transitionRules[from][to];
  if (!rule) {
    throw new TicketStatusTransitionInvalidError();
  }

  if (rule.confirmationRequired && confirmation !== true) {
    throw new StatusConfirmationRequiredError();
  }
}

export function statusTransitionRequiresConfirmation(
  from: TicketStatus,
  to: TicketStatus,
) {
  return transitionRules[from][to]?.confirmationRequired ?? false;
}

export { statusValues };
