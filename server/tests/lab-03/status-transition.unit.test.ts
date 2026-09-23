import { describe, expect, it } from "vitest";

import {
  assertAllowedStatusTransition,
  StatusConfirmationRequiredError,
  TicketStatusTransitionInvalidError,
} from "../../src/services/ticket-status-service.js";

describe("Ticket status transition matrix", () => {
  const allowedWithoutConfirmation = [
    ["NEW", "OPEN"],
    ["OPEN", "IN_PROGRESS"],
    ["OPEN", "WAITING_FOR_REQUESTER"],
    ["IN_PROGRESS", "OPEN"],
    ["IN_PROGRESS", "WAITING_FOR_REQUESTER"],
    ["WAITING_FOR_REQUESTER", "OPEN"],
    ["WAITING_FOR_REQUESTER", "IN_PROGRESS"],
    ["REOPENED", "OPEN"],
    ["REOPENED", "IN_PROGRESS"],
    ["REOPENED", "WAITING_FOR_REQUESTER"],
  ] as const;

  const allowedWithConfirmation = [
    ["NEW", "CANCELLED"],
    ["OPEN", "RESOLVED"],
    ["OPEN", "CANCELLED"],
    ["IN_PROGRESS", "RESOLVED"],
    ["IN_PROGRESS", "CANCELLED"],
    ["WAITING_FOR_REQUESTER", "RESOLVED"],
    ["WAITING_FOR_REQUESTER", "CANCELLED"],
    ["RESOLVED", "CLOSED"],
    ["RESOLVED", "REOPENED"],
    ["CLOSED", "REOPENED"],
    ["REOPENED", "RESOLVED"],
    ["REOPENED", "CANCELLED"],
    ["CANCELLED", "REOPENED"],
  ] as const;

  it.each(allowedWithoutConfirmation)(
    "allows %s to %s without confirmation",
    (from, to) => {
      expect(() =>
        assertAllowedStatusTransition(from, to, false),
      ).not.toThrow();
    },
  );

  it.each(allowedWithConfirmation)(
    "requires confirmation for %s to %s",
    (from, to) => {
      expect(() => assertAllowedStatusTransition(from, to, false)).toThrow(
        StatusConfirmationRequiredError,
      );
      expect(() => assertAllowedStatusTransition(from, to, true)).not.toThrow();
    },
  );

  it.each([
    ["NEW", "IN_PROGRESS"],
    ["OPEN", "CLOSED"],
    ["RESOLVED", "OPEN"],
    ["CLOSED", "RESOLVED"],
    ["CANCELLED", "OPEN"],
    ["OPEN", "OPEN"],
  ] as const)("rejects unlisted transition %s to %s", (from, to) => {
    expect(() => assertAllowedStatusTransition(from, to, true)).toThrow(
      TicketStatusTransitionInvalidError,
    );
  });
});
