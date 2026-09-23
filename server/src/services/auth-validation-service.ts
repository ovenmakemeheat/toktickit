import { z } from "zod";

import {
  passwordMaxLength,
  passwordMinLength,
  validatePassword,
} from "./password-service.js";

const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(passwordMaxLength),
  })
  .strict();

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(passwordMaxLength),
    newPassword: z.string().min(1).max(passwordMaxLength),
    confirmPassword: z.string().min(1).max(passwordMaxLength),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export type AuthFieldError = {
  field: string;
  code: string;
  message: string;
};

export class AuthInputValidationError extends Error {
  readonly code: string;
  readonly fields: AuthFieldError[];

  constructor(code: string, fields: AuthFieldError[]) {
    super("One or more authentication fields are invalid");
    this.name = "AuthInputValidationError";
    this.code = code;
    this.fields = fields;
  }
}

function messageForLoginField(field: string) {
  switch (field) {
    case "email":
      return "Enter a valid email address.";
    case "password":
      return "Password is required.";
    default:
      return `${field} is not accepted.`;
  }
}

function messageForPasswordField(field: string) {
  switch (field) {
    case "currentPassword":
      return "Current password is required.";
    case "newPassword":
      return "Enter a new password that meets the password rules.";
    case "confirmPassword":
      return "Confirm the new password.";
    default:
      return `${field} is not accepted.`;
  }
}

function zodFields(
  issues: z.ZodIssue[],
  messageForField: (field: string) => string,
) {
  const fields = new Map<string, AuthFieldError>();
  for (const issue of issues) {
    const field = issue.path[0]?.toString() ?? "body";
    fields.set(field, {
      field,
      code: "INVALID_VALUE",
      message: messageForField(field),
    });
  }
  return [...fields.values()];
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseLoginInput(rawInput: unknown): LoginInput {
  const result = loginSchema.safeParse(rawInput);
  if (!result.success) {
    throw new AuthInputValidationError(
      "LOGIN_INPUT_INVALID",
      zodFields(result.error.issues, messageForLoginField),
    );
  }

  return { ...result.data, email: normalizeEmail(result.data.email) };
}

export function parsePasswordChangeInput(
  rawInput: unknown,
): PasswordChangeInput {
  const result = passwordChangeSchema.safeParse(rawInput);
  if (!result.success) {
    throw new AuthInputValidationError(
      "PASSWORD_INPUT_INVALID",
      zodFields(result.error.issues, messageForPasswordField),
    );
  }

  const fields: AuthFieldError[] = [];
  const policyError = validatePassword(result.data.newPassword);
  if (policyError) {
    fields.push({
      field: "newPassword",
      code: policyError.code,
      message: `Password must contain ${passwordMinLength}-${passwordMaxLength} characters, including a letter, a number, and a non-alphanumeric character.`,
    });
  }
  if (result.data.newPassword !== result.data.confirmPassword) {
    fields.push({
      field: "confirmPassword",
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "New password and confirmation must match.",
    });
  }
  if (fields.length > 0) {
    throw new AuthInputValidationError("PASSWORD_INPUT_INVALID", fields);
  }

  return result.data;
}
