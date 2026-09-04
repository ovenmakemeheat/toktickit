import { z } from "zod";

const createTicketInputSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    categoryId: z.number().int().positive(),
    relatedSystemId: z.number().int().positive(),
    requestedPriority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    summary: z.string().trim().min(5).max(120),
    description: z.string().trim().min(20).max(4000),
  })
  .strict();

export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

export type TicketFieldError = {
  field: string;
  code: string;
  message: string;
};

export class TicketInputValidationError extends Error {
  readonly code = "TICKET_INPUT_INVALID";
  readonly fields: TicketFieldError[];

  constructor(fields: TicketFieldError[]) {
    super("One or more ticket fields are invalid");
    this.name = "TicketInputValidationError";
    this.fields = fields;
  }
}

function messageForField(field: string) {
  switch (field) {
    case "clientRequestId":
      return "clientRequestId must be a valid UUID";
    case "categoryId":
      return "Category is required and must be a positive integer";
    case "relatedSystemId":
      return "Related System is required and must be a positive integer";
    case "requestedPriority":
      return "Requested Priority must be LOW, MEDIUM, or HIGH";
    case "summary":
      return "Summary must contain 5-120 characters after trimming";
    case "description":
      return "Description must contain 20-4000 characters after trimming";
    default:
      return `${field} is not accepted`;
  }
}

export function validateCreateTicketInput(input: unknown): CreateTicketInput {
  const result = createTicketInputSchema.safeParse(input);

  if (!result.success) {
    const fields = new Map<string, TicketFieldError>();

    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString() ?? "body";
      fields.set(field, {
        field,
        code: "INVALID_VALUE",
        message: messageForField(field),
      });
    }

    throw new TicketInputValidationError([...fields.values()]);
  }

  return result.data;
}
