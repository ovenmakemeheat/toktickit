import { describe, expect, it } from "vitest";

import {
  formatTicketNumber,
  generateTicketNumber,
  ticketNumberPattern,
} from "../../src/services/ticket-number-service.js";

describe("Lab 2 Ticket Number generation", () => {
  const ticketDate = new Date("2026-08-27T12:34:56.000Z");

  it("formats a Ticket Number with the server date and uppercase suffix", () => {
    expect(formatTicketNumber(ticketDate, "ab12cd")).toBe("TT-20260827-AB12CD");
  });

  it("generates values that match the approved Ticket Number contract", () => {
    expect(generateTicketNumber(ticketDate)).toMatch(ticketNumberPattern);
  });

  it("rejects suffixes that cannot produce a six-character identifier", () => {
    expect(() => formatTicketNumber(ticketDate, "short")).toThrowError(
      "Ticket Number suffix must contain six uppercase characters",
    );
    expect(() => formatTicketNumber(ticketDate, "unsafe/")).toThrowError();
  });
});
