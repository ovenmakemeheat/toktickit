import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  formatTicketNumber,
  generateTicketNumber,
  ticketNumberPattern,
} from "../../src/services/ticket-number-service.js";
import { createTicket } from "../../src/services/ticket-service.js";

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

  it("retries a Ticket Number collision without returning a duplicate", async () => {
    const input = {
      clientRequestId: "00000000-0000-4000-8000-000000000001",
      categoryId: 2,
      relatedSystemId: 4,
      requestedPriority: "HIGH" as const,
      summary: "VPN connection fails",
      description: "The VPN connection fails after entering the credentials.",
    };
    const generatedNumbers = ["TT-20260827-AAAAAA", "TT-20260827-BBBBBB"];
    const attemptedNumbers = [...generatedNumbers];
    const ticketNumberGenerator = vi
      .fn<(date: Date) => string>()
      .mockImplementation(() => generatedNumbers.shift() ?? "");
    const collisionError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`ticketNumber`)",
      { code: "P2002", clientVersion: "6.19.0" },
    );
    const storedTicket = {
      id: 501,
      ticketNumber: "TT-20260827-BBBBBB",
      clientRequestId: input.clientRequestId,
      ticketDate,
      requesterId: 11,
      categoryId: input.categoryId,
      relatedSystemId: input.relatedSystemId,
      requestedPriority: input.requestedPriority,
      summary: input.summary,
      description: input.description,
      currentStatus: "NEW" as const,
      createdAt: ticketDate,
      updatedAt: ticketDate,
      requester: { id: 11, name: "Requester A" },
      category: { id: input.categoryId, name: "Hardware" },
      relatedSystem: { id: input.relatedSystemId, name: "VPN" },
      attachments: [],
    };
    const ticketCreate = vi
      .fn()
      .mockRejectedValueOnce(collisionError)
      .mockResolvedValueOnce(storedTicket);
    const ticketStore = {
      developmentRequester: {
        findFirst: vi.fn().mockResolvedValue({
          id: 11,
          name: "Requester A",
          email: "requester-a@toktickit.test",
        }),
      },
      category: {
        findFirst: vi.fn().mockResolvedValue({ id: input.categoryId }),
      },
      relatedSystem: {
        findFirst: vi.fn().mockResolvedValue({ id: input.relatedSystemId }),
      },
      ticket: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: ticketCreate,
      },
    };

    const result = await createTicket(
      ticketStore as unknown as Parameters<typeof createTicket>[0],
      "11",
      input,
      ticketDate,
      ticketNumberGenerator,
    );

    expect(result.replayed).toBe(false);
    expect(result.ticket.ticketNumber).toBe("TT-20260827-BBBBBB");
    expect(ticketNumberGenerator).toHaveBeenCalledTimes(2);
    expect(ticketCreate).toHaveBeenCalledTimes(2);
    expect(
      ticketCreate.mock.calls.map(
        ([arguments_]) => arguments_.data.ticketNumber,
      ),
    ).toEqual(attemptedNumbers);
  });
});
