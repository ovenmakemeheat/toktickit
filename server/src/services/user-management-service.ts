import { Prisma, type PrismaClient, type Role } from "@prisma/client";
import { z } from "zod";

import { normalizeEmail } from "./auth-validation-service.js";
import {
  hashPassword,
  passwordMaxLength,
  validatePassword,
} from "./password-service.js";
import {
  acquireUserOwnershipLock,
  serializableTransactionOptions,
} from "./transaction-service.js";

const roleValues = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
const supportedUserQueryKeys = new Set(["search", "role"]);
const searchMaxLength = 120;
const nameMaxLength = 120;
const emailMaxLength = 254;

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
};

export type UserQuery = {
  search: string;
  role: Role | undefined;
};

export type UserManagementFieldError = {
  field: string;
  code: string;
  message: string;
};

export class UserQueryValidationError extends Error {
  readonly code = "USER_QUERY_INVALID";
  readonly fields: UserManagementFieldError[];

  constructor(fields: UserManagementFieldError[]) {
    super("One or more User list filters are invalid");
    this.name = "UserQueryValidationError";
    this.fields = fields;
  }
}

export class UserIdValidationError extends Error {
  readonly code = "USER_INPUT_INVALID";
  readonly fields: UserManagementFieldError[] = [
    {
      field: "userId",
      code: "INVALID_VALUE",
      message: "User ID must be a positive integer.",
    },
  ];

  constructor() {
    super("User ID must be a positive integer.");
    this.name = "UserIdValidationError";
  }
}

export class UserInputValidationError extends Error {
  readonly code = "USER_INPUT_INVALID";
  readonly fields: UserManagementFieldError[];

  constructor(fields: UserManagementFieldError[]) {
    super("One or more User fields are invalid");
    this.name = "UserInputValidationError";
    this.fields = fields;
  }
}

export class PasswordInputValidationError extends Error {
  readonly code = "PASSWORD_INPUT_INVALID";
  readonly fields: UserManagementFieldError[];

  constructor(fields: UserManagementFieldError[]) {
    super("The initial password is invalid");
    this.name = "PasswordInputValidationError";
    this.fields = fields;
  }
}

export class EmailAlreadyExistsError extends Error {
  readonly code = "EMAIL_ALREADY_EXISTS";

  constructor() {
    super("A User with this email address already exists.");
    this.name = "EmailAlreadyExistsError";
  }
}

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("This User is not available.");
    this.name = "UserNotFoundError";
  }
}

export class SelfDeactivationNotAllowedError extends Error {
  readonly code = "SELF_DEACTIVATION_NOT_ALLOWED";

  constructor() {
    super("You cannot deactivate your own Administrator account.");
    this.name = "SelfDeactivationNotAllowedError";
  }
}

export class LastAdministratorRequiredError extends Error {
  readonly code = "LAST_ADMINISTRATOR_REQUIRED";

  constructor() {
    super("The last active Administrator cannot be changed or deactivated.");
    this.name = "LastAdministratorRequiredError";
  }
}

export class UserOwnsTicketsError extends Error {
  readonly code = "USER_OWNS_TICKETS";

  constructor() {
    super(
      "This User owns existing Tickets and must stay an active IT Staff or Administrator.",
    );
    this.name = "UserOwnsTicketsError";
  }
}

export class TransactionFailedError extends Error {
  readonly code = "USER_MANAGEMENT_TRANSACTION_FAILED";

  constructor() {
    super("Unable to complete the User Management operation");
    this.name = "TransactionFailedError";
  }
}

const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(nameMaxLength),
    email: z.string().trim().email().max(emailMaxLength),
    role: z.enum(roleValues),
    active: z.boolean(),
    initialPassword: z.string().min(1).max(passwordMaxLength),
    confirmInitialPassword: z.string().min(1).max(passwordMaxLength),
  })
  .strict();

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(nameMaxLength).optional(),
    email: z.string().trim().email().max(emailMaxLength).optional(),
    role: z.enum(roleValues).optional(),
    active: z.boolean().optional(),
  })
  .strict();

const initialPasswordSchema = z
  .object({
    initialPassword: z.string().min(1).max(passwordMaxLength),
    confirmInitialPassword: z.string().min(1).max(passwordMaxLength),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type InitialPasswordInput = z.infer<typeof initialPasswordSchema>;

type UserManagementStore = Pick<
  PrismaClient,
  "user" | "ticket" | "session" | "$transaction"
>;

const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} as const satisfies Prisma.UserSelect;

function toUserListItem(user: {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}): UserListItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.active ? "ACTIVE" : "INACTIVE",
  };
}

function userFieldMessage(field: string) {
  switch (field) {
    case "name":
      return `Name is required and must be ${nameMaxLength} characters or fewer.`;
    case "email":
      return "Enter a valid email address.";
    case "role":
      return "Choose exactly one permitted role.";
    case "active":
      return "Choose whether the account is active.";
    case "initialPassword":
    case "confirmInitialPassword":
      return "Enter an initial password that meets the password rules.";
    case "userId":
      return "User ID must be a positive integer.";
    default:
      return `${field} is not accepted.`;
  }
}

function zodFieldErrors(
  issues: z.ZodIssue[],
  code: string,
  acceptsRole: boolean,
) {
  const fields = new Map<string, UserManagementFieldError>();
  for (const issue of issues) {
    const field = issue.path[0]?.toString() ?? "body";
    fields.set(field, {
      field,
      code: acceptsRole && field === "role" ? "INVALID_ROLE" : code,
      message: userFieldMessage(field),
    });
  }
  return [...fields.values()];
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function parseUserId(rawUserId: unknown): number {
  const parsed =
    typeof rawUserId === "string" && /^[1-9]\d*$/.test(rawUserId)
      ? Number(rawUserId)
      : typeof rawUserId === "number"
        ? rawUserId
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new UserIdValidationError();
  }
  return parsed;
}

export function parseUserQuery(rawQuery: unknown): UserQuery {
  const query =
    rawQuery && typeof rawQuery === "object"
      ? (rawQuery as Record<string, unknown>)
      : {};
  const fields: UserManagementFieldError[] = [];

  for (const key of Object.keys(query)) {
    if (!supportedUserQueryKeys.has(key)) {
      fields.push({
        field: key,
        code: "INVALID_VALUE",
        message: `${key} is not accepted.`,
      });
    }
  }

  const rawSearch = query.search;
  let search = "";
  if (rawSearch !== undefined && rawSearch !== "") {
    if (typeof rawSearch !== "string") {
      fields.push({
        field: "search",
        code: "INVALID_VALUE",
        message: `Search must be a string of ${searchMaxLength} characters or fewer.`,
      });
    } else if (rawSearch.length > searchMaxLength) {
      fields.push({
        field: "search",
        code: "INVALID_VALUE",
        message: `Search must be a string of ${searchMaxLength} characters or fewer.`,
      });
    } else {
      search = rawSearch.trim();
    }
  }

  const rawRole = query.role;
  let role: Role | undefined;
  if (rawRole !== undefined && rawRole !== "") {
    if (typeof rawRole !== "string" || !roleValues.includes(rawRole as Role)) {
      fields.push({
        field: "role",
        code: "INVALID_ROLE",
        message: "Choose one of REQUESTER, IT_STAFF, or ADMINISTRATOR.",
      });
    } else {
      role = rawRole as Role;
    }
  }

  if (fields.length > 0) {
    throw new UserQueryValidationError(fields);
  }

  return { search, role };
}

export function parseCreateUserInput(rawInput: unknown): CreateUserInput {
  const result = createUserSchema.safeParse(rawInput);
  if (!result.success) {
    throw new UserInputValidationError(
      zodFieldErrors(result.error.issues, "INVALID_VALUE", true),
    );
  }

  const passwordFields: UserManagementFieldError[] = [];
  const policyError = validatePassword(result.data.initialPassword);
  if (policyError) {
    passwordFields.push({
      field: "initialPassword",
      code: policyError.code,
      message: policyError.message,
    });
  }
  if (result.data.initialPassword !== result.data.confirmInitialPassword) {
    passwordFields.push({
      field: "confirmInitialPassword",
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "Initial password and confirmation must match.",
    });
  }
  if (passwordFields.length > 0) {
    throw new PasswordInputValidationError(passwordFields);
  }

  return { ...result.data, email: normalizeEmail(result.data.email) };
}

export function parseUpdateUserInput(rawInput: unknown): UpdateUserInput {
  if (rawInput && typeof rawInput === "object") {
    for (const key of Object.keys(rawInput)) {
      if (!["name", "email", "role", "active"].includes(key)) {
        throw new UserInputValidationError([
          {
            field: key,
            code: "INVALID_VALUE",
            message: `${key} is not accepted.`,
          },
        ]);
      }
    }
  }

  const result = updateUserSchema.safeParse(rawInput);
  if (!result.success) {
    throw new UserInputValidationError(
      zodFieldErrors(result.error.issues, "INVALID_VALUE", true),
    );
  }

  if (Object.keys(result.data).length === 0) {
    throw new UserInputValidationError([
      {
        field: "body",
        code: "INVALID_VALUE",
        message: "Provide at least one field to update.",
      },
    ]);
  }

  return {
    ...result.data,
    ...(result.data.email ? { email: normalizeEmail(result.data.email) } : {}),
  };
}

export function parseInitialPasswordInput(
  rawInput: unknown,
): InitialPasswordInput {
  const result = initialPasswordSchema.safeParse(rawInput);
  if (!result.success) {
    throw new PasswordInputValidationError(
      zodFieldErrors(result.error.issues, "INVALID_VALUE", false),
    );
  }

  const fields: UserManagementFieldError[] = [];
  const policyError = validatePassword(result.data.initialPassword);
  if (policyError) {
    fields.push({
      field: "initialPassword",
      code: policyError.code,
      message: policyError.message,
    });
  }
  if (result.data.initialPassword !== result.data.confirmInitialPassword) {
    fields.push({
      field: "confirmInitialPassword",
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "Initial password and confirmation must match.",
    });
  }
  if (fields.length > 0) {
    throw new PasswordInputValidationError(fields);
  }

  return result.data;
}

export async function listUsers(
  prisma: Pick<PrismaClient, "user">,
  rawQuery: unknown,
): Promise<UserListItem[]> {
  const query = parseUserQuery(rawQuery);
  const users = await prisma.user.findMany({
    where: {
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" },
              },
              {
                email: { contains: query.search, mode: "insensitive" },
              },
            ],
          }
        : {}),
      ...(query.role === undefined ? {} : { role: query.role }),
    },
    select: userListSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return users.map(toUserListItem);
}

export async function createUser(
  prisma: Pick<PrismaClient, "user">,
  rawInput: unknown,
): Promise<UserListItem> {
  const input = parseCreateUserInput(rawInput);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.initialPassword);
  try {
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        active: input.active,
        passwordHash,
        mustChangePassword: true,
      },
      select: userListSelect,
    });
    return toUserListItem(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EmailAlreadyExistsError();
    }
    throw error;
  }
}

function remainsEligibleOwner(user: { role: Role; active: boolean }) {
  return (
    user.active && (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR")
  );
}

export async function updateUser(
  prisma: UserManagementStore,
  actingUserId: number,
  rawUserId: unknown,
  rawInput: unknown,
): Promise<UserListItem> {
  const userId = parseUserId(rawUserId);
  const input = parseUpdateUserInput(rawInput);

  try {
    return await prisma.$transaction(async (transaction) => {
      await acquireUserOwnershipLock(transaction);
      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, active: true },
      });
      if (!target) {
        throw new UserNotFoundError();
      }

      const nextRole = input.role ?? target.role;
      const nextActive = input.active ?? target.active;

      if (target.id === actingUserId && !nextActive) {
        throw new SelfDeactivationNotAllowedError();
      }

      const losesAdministrator =
        target.role === "ADMINISTRATOR" &&
        target.active &&
        (nextRole !== "ADMINISTRATOR" || !nextActive);
      if (losesAdministrator) {
        const activeAdministrators = await transaction.user.count({
          where: { role: "ADMINISTRATOR", active: true },
        });
        if (activeAdministrators <= 1) {
          throw new LastAdministratorRequiredError();
        }
      }

      if (
        !remainsEligibleOwner({ role: nextRole, active: nextActive }) &&
        (target.role !== nextRole || target.active !== nextActive)
      ) {
        const ownedTickets = await transaction.ticket.count({
          where: { primaryOwnerUserId: userId },
        });
        if (ownedTickets > 0) {
          throw new UserOwnsTicketsError();
        }
      }

      try {
        const updated = await transaction.user.update({
          where: { id: userId },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.email === undefined ? {} : { email: input.email }),
            ...(input.role === undefined ? {} : { role: input.role }),
            ...(input.active === undefined ? {} : { active: input.active }),
          },
          select: userListSelect,
        });
        return toUserListItem(updated);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new EmailAlreadyExistsError();
        }
        throw error;
      }
    }, serializableTransactionOptions);
  } catch (error) {
    if (
      error instanceof UserNotFoundError ||
      error instanceof SelfDeactivationNotAllowedError ||
      error instanceof LastAdministratorRequiredError ||
      error instanceof UserOwnsTicketsError ||
      error instanceof EmailAlreadyExistsError ||
      error instanceof UserInputValidationError
    ) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new TransactionFailedError();
    }
    throw error;
  }
}

export async function setInitialPassword(
  prisma: UserManagementStore,
  rawUserId: unknown,
  rawInput: unknown,
  now = new Date(),
): Promise<void> {
  const userId = parseUserId(rawUserId);
  const input = parseInitialPasswordInput(rawInput);
  const passwordHash = await hashPassword(input.initialPassword);

  try {
    await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!target) {
        throw new UserNotFoundError();
      }

      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true },
      });
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  } catch (error) {
    if (
      error instanceof UserNotFoundError ||
      error instanceof PasswordInputValidationError
    ) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new TransactionFailedError();
    }
    throw error;
  }
}
