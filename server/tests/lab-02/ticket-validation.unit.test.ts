import { describe, expect, it } from "vitest";

import {
  TicketInputValidationError,
  validateCreateTicketInput,
} from "../../src/services/ticket-validation-service.js";

const validInput = {
  clientRequestId: "4c4f2e3e-7db2-4c68-8ba2-1e1a7e7b63aa",
  categoryId: 2,
  relatedSystemId: 3,
  requestedPriority: "MEDIUM",
  summary: "Cannot connect to the VPN",
  description: "The VPN connection fails after entering the credentials.",
};

function getValidationError(input: unknown) {
  let caught: unknown;

  try {
    validateCreateTicketInput(input);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(TicketInputValidationError);
  return caught as TicketInputValidationError;
}

describe("Lab 2 Create Ticket validation", () => {
  it("trims text before returning the persistence input", () => {
    expect(
      validateCreateTicketInput({
        ...validInput,
        summary: "  Cannot connect to the VPN  ",
        description:
          "  The VPN connection fails after entering the credentials.  ",
      }),
    ).toEqual({
      ...validInput,
      summary: "Cannot connect to the VPN",
      description: "The VPN connection fails after entering the credentials.",
    });
  });

  it("accepts the inclusive summary and description length boundaries", () => {
    expect(
      validateCreateTicketInput({
        ...validInput,
        summary: "a".repeat(5),
        description: "d".repeat(20),
      }),
    ).toEqual(
      expect.objectContaining({
        summary: "a".repeat(5),
        description: "d".repeat(20),
      }),
    );

    expect(() =>
      validateCreateTicketInput({
        ...validInput,
        summary: "a".repeat(121),
        description: "d".repeat(4001),
      }),
    ).toThrowError(TicketInputValidationError);
  });

  it("returns field-level errors for invalid values and unexpected fields", () => {
    const error = getValidationError({
      ...validInput,
      categoryId: 0,
      requestedPriority: "URGENT",
      summary: "no",
      description: "too short",
      ticketNumber: "TT-20260827-ABC123",
    });

    expect(error.code).toBe("TICKET_INPUT_INVALID");
    expect(error.fields.map((field) => field.field)).toEqual(
      expect.arrayContaining([
        "categoryId",
        "requestedPriority",
        "summary",
        "description",
        "body",
      ]),
    );
  });
});
