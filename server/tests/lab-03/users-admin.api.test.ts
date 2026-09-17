import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app, loginAgent, prepareLab3Data, prisma } from "./test-helpers.js";

let administrator!: Awaited<ReturnType<typeof loginAgent>>;
let requester!: Awaited<ReturnType<typeof loginAgent>>;
let staff!: Awaited<ReturnType<typeof loginAgent>>;

const createdUserIds: number[] = [];

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@toktickit.test`;
}

async function createManagedUser(options: {
  name: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  active?: boolean;
  email?: string;
  initialPassword?: string;
}) {
  const email = options.email ?? uniqueEmail("managed");
  const initialPassword = options.initialPassword ?? "InitialPassword!1";
  const response = await administrator.agent
    .post("/api/admin/users")
    .set("X-CSRF-Token", administrator.csrfToken)
    .send({
      name: options.name,
      email,
      role: options.role,
      active: options.active ?? true,
      initialPassword,
      confirmInitialPassword: initialPassword,
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  createdUserIds.push(response.body.id as number);
  return { id: response.body.id as number, email, initialPassword };
}

beforeAll(async () => {
  await prepareLab3Data();
  administrator = await loginAgent("administrator@toktickit.test");
  requester = await loginAgent("requester-a@toktickit.test");
  staff = await loginAgent("it-staff-a@toktickit.test");
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.session.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("Administrator User Management", () => {
  it("lists Users with Name, Email, Role, and Status and supports search and one role filter", async () => {
    const all = await administrator.agent.get("/api/admin/users");
    expect(all.status).toBe(200);
    expect(Array.isArray(all.body)).toBe(true);
    expect(all.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
          status: expect.stringMatching(/^(ACTIVE|INACTIVE)$/),
        }),
      ]),
    );
    expect(all.body.map((user: { email: string }) => user.email)).toContain(
      "administrator@toktickit.test",
    );

    const searched = await administrator.agent.get(
      "/api/admin/users?search=requester-a",
    );
    expect(searched.status).toBe(200);
    expect(searched.body).toEqual([
      expect.objectContaining({
        email: "requester-a@toktickit.test",
        role: "REQUESTER",
        status: "ACTIVE",
      }),
    ]);

    const byEmail = await administrator.agent.get(
      "/api/admin/users?search=IT-STAFF-B@TOKTICKIT.TEST",
    );
    expect(byEmail.status).toBe(200);
    expect(byEmail.body).toHaveLength(1);

    const filtered = await administrator.agent.get(
      "/api/admin/users?role=IT_STAFF",
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.length).toBeGreaterThanOrEqual(4);
    expect(
      filtered.body.every((user: { role: string }) => user.role === "IT_STAFF"),
    ).toBe(true);

    const ordered = all.body.map((user: { name: string }) => user.name);
    expect(ordered).toEqual(
      [...ordered].sort((left, right) => left.localeCompare(right)),
    );
  });

  it("returns documented invalid-query and forbidden responses", async () => {
    const invalidKey = await administrator.agent.get(
      "/api/admin/users?sortBy=name",
    );
    expect(invalidKey.status).toBe(400);
    expect(invalidKey.body.error).toEqual(
      expect.objectContaining({ code: "USER_QUERY_INVALID" }),
    );

    const invalidRole = await administrator.agent.get(
      "/api/admin/users?role=SUPERUSER",
    );
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error.code).toBe("USER_QUERY_INVALID");

    const forbiddenList = await requester.agent.get("/api/admin/users");
    expect(forbiddenList.status).toBe(403);
    expect(forbiddenList.body.error.code).toBe("USER_MANAGEMENT_FORBIDDEN");

    const forbiddenCreate = await staff.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", staff.csrfToken)
      .send({
        name: "Not Allowed",
        email: uniqueEmail("forbidden"),
        role: "REQUESTER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!1",
      });
    expect(forbiddenCreate.status).toBe(403);
    expect(forbiddenCreate.body.error.code).toBe("USER_MANAGEMENT_FORBIDDEN");

    const missingCsrf = await administrator.agent
      .post("/api/admin/users")
      .send({
        name: "No CSRF",
        email: uniqueEmail("csrf"),
        role: "REQUESTER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!1",
      });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("creates a User with a hashed initial password and rejects invalid input", async () => {
    const { id, email } = await createManagedUser({
      name: "Managed Staff",
      role: "IT_STAFF",
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(stored.email).toBe(email);
    expect(stored.role).toBe("IT_STAFF");
    expect(stored.active).toBe(true);
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).not.toContain("InitialPassword!1");
    expect(stored.passwordHash.startsWith("scrypt$")).toBe(true);

    const duplicate = await administrator.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "Duplicate",
        email: email.toUpperCase(),
        role: "REQUESTER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!1",
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_EXISTS");

    const invalidRole = await administrator.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "Bad Role",
        email: uniqueEmail("bad-role"),
        role: "SUPERUSER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!1",
      });
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error.code).toBe("USER_INPUT_INVALID");

    const weakPassword = await administrator.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "Weak Password",
        email: uniqueEmail("weak"),
        role: "REQUESTER",
        active: true,
        initialPassword: "short",
        confirmInitialPassword: "short",
      });
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.body.error.code).toBe("PASSWORD_INPUT_INVALID");

    const mismatched = await administrator.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "Mismatch",
        email: uniqueEmail("mismatch"),
        role: "REQUESTER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!2",
      });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error.code).toBe("PASSWORD_INPUT_INVALID");

    const unknownField = await administrator.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "Unknown Field",
        email: uniqueEmail("unknown"),
        role: "REQUESTER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!1",
        department: "IT",
      });
    expect(unknownField.status).toBe(400);
    expect(unknownField.body.error.code).toBe("USER_INPUT_INVALID");

    const rejected = await administrator.agent
      .post("/api/admin/users")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "",
        email: "not-an-email",
        role: "REQUESTER",
        active: true,
        initialPassword: "InitialPassword!1",
        confirmInitialPassword: "InitialPassword!1",
      });
    expect(rejected.status).toBe(400);
    expect(await prisma.user.count({ where: { email: "not-an-email" } })).toBe(
      0,
    );
  });

  it("edits name, email, role, and activation state and rejects unsafe updates atomically", async () => {
    const { id, email } = await createManagedUser({
      name: "Edit Target",
      role: "REQUESTER",
    });

    const updated = await administrator.agent
      .patch(`/api/admin/users/${id}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        name: "Edited Name",
        email: `edited-${email}`,
        role: "IT_STAFF",
        active: false,
      });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body).toEqual({
      id,
      name: "Edited Name",
      email: `edited-${email}`,
      role: "IT_STAFF",
      status: "INACTIVE",
    });

    const other = await createManagedUser({
      name: "Conflict Owner",
      role: "REQUESTER",
    });
    const duplicate = await administrator.agent
      .patch(`/api/admin/users/${id}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ email: other.email });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id },
          select: { email: true },
        })
      ).email,
    ).toBe(`edited-${email}`);

    const unknown = await administrator.agent
      .patch("/api/admin/users/99999999")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ name: "Nobody" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("USER_NOT_FOUND");

    const malformedId = await administrator.agent
      .patch("/api/admin/users/not-a-number")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ name: "Nobody" });
    expect(malformedId.status).toBe(400);
    expect(malformedId.body.error.code).toBe("USER_INPUT_INVALID");

    const emptyUpdate = await administrator.agent
      .patch(`/api/admin/users/${id}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({});
    expect(emptyUpdate.status).toBe(400);
    expect(emptyUpdate.body.error.code).toBe("USER_INPUT_INVALID");

    const invalidRole = await administrator.agent
      .patch(`/api/admin/users/${id}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ role: "SUPERUSER" });
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error.code).toBe("USER_INPUT_INVALID");

    const invalidPasswordField = await administrator.agent
      .patch(`/api/admin/users/${id}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ passwordHash: "x" });
    expect(invalidPasswordField.status).toBe(400);
    expect(invalidPasswordField.body.error.code).toBe("USER_INPUT_INVALID");
  });

  it("enforces Administrator and Ticket-ownership account safety", async () => {
    const selfDeactivation = await administrator.agent
      .patch(`/api/admin/users/${administrator.userId}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ active: false });
    expect(selfDeactivation.status).toBe(409);
    expect(selfDeactivation.body.error.code).toBe(
      "SELF_DEACTIVATION_NOT_ALLOWED",
    );
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: administrator.userId },
          select: { active: true },
        })
      ).active,
    ).toBe(true);

    const lastAdministrator = await administrator.agent
      .patch(`/api/admin/users/${administrator.userId}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ role: "REQUESTER" });
    expect(lastAdministrator.status).toBe(409);
    expect(lastAdministrator.body.error.code).toBe(
      "LAST_ADMINISTRATOR_REQUIRED",
    );

    const owner = await prisma.ticket.findFirst({
      where: {
        primaryOwnerUserId: { not: null },
        primaryOwner: { role: "IT_STAFF" },
      },
      select: { primaryOwnerUserId: true },
    });
    expect(owner?.primaryOwnerUserId).toBeTruthy();

    const ownsTickets = await administrator.agent
      .patch(`/api/admin/users/${owner?.primaryOwnerUserId}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ active: false });
    expect(ownsTickets.status).toBe(409);
    expect(ownsTickets.body.error.code).toBe("USER_OWNS_TICKETS");

    const ownsTicketsRole = await administrator.agent
      .patch(`/api/admin/users/${owner?.primaryOwnerUserId}`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({ role: "REQUESTER" });
    expect(ownsTicketsRole.status).toBe(409);
    expect(ownsTicketsRole.body.error.code).toBe("USER_OWNS_TICKETS");

    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: owner?.primaryOwnerUserId ?? 0 },
          select: { role: true, active: true },
        })
      ).role,
    ).toBe("IT_STAFF");
  });

  it("sets a new initial password, revokes sessions, and forces the next login to change it", async () => {
    const target = await createManagedUser({
      name: "Reset Target",
      role: "REQUESTER",
      initialPassword: "InitialPassword!1",
    });
    await prisma.user.update({
      where: { id: target.id },
      data: { mustChangePassword: false },
    });

    const targetAgent = request.agent(app);
    const targetLogin = await targetAgent
      .post("/api/auth/login")
      .send({ email: target.email, password: "InitialPassword!1" });
    expect(targetLogin.status, JSON.stringify(targetLogin.body)).toBe(200);
    expect(targetLogin.body.user.mustChangePassword).toBe(false);
    expect(
      await prisma.session.count({
        where: { userId: target.id, revokedAt: null },
      }),
    ).toBe(1);

    const reset = await administrator.agent
      .post(`/api/admin/users/${target.id}/initial-password`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        initialPassword: "ReplacementPassword!2",
        confirmInitialPassword: "ReplacementPassword!2",
      });
    expect(reset.status, JSON.stringify(reset.body)).toBe(204);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { passwordHash: true, mustChangePassword: true },
    });
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).not.toContain("ReplacementPassword");
    expect(
      await prisma.session.count({
        where: { userId: target.id, revokedAt: null },
      }),
    ).toBe(0);

    const revokedSession = await targetAgent.get("/api/auth/me");
    expect(revokedSession.status).toBe(401);

    const stalePassword = await request
      .agent(app)
      .post("/api/auth/login")
      .send({ email: target.email, password: "InitialPassword!1" });
    expect(stalePassword.status).toBe(401);

    const nextLogin = await request
      .agent(app)
      .post("/api/auth/login")
      .send({ email: target.email, password: "ReplacementPassword!2" });
    expect(nextLogin.status).toBe(200);
    expect(nextLogin.body.user.mustChangePassword).toBe(true);

    const limitedAgent = request.agent(app);
    const limited = await limitedAgent
      .post("/api/auth/login")
      .send({ email: target.email, password: "ReplacementPassword!2" });
    expect(limited.status).toBe(200);
    expect(limited.body.user.mustChangePassword).toBe(true);

    const blocked = await limitedAgent.get("/api/admin/users");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const weakReset = await administrator.agent
      .post(`/api/admin/users/${target.id}/initial-password`)
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        initialPassword: "weak",
        confirmInitialPassword: "weak",
      });
    expect(weakReset.status).toBe(400);
    expect(weakReset.body.error.code).toBe("PASSWORD_INPUT_INVALID");

    const unknownUser = await administrator.agent
      .post("/api/admin/users/99999999/initial-password")
      .set("X-CSRF-Token", administrator.csrfToken)
      .send({
        initialPassword: "ReplacementPassword!2",
        confirmInitialPassword: "ReplacementPassword!2",
      });
    expect(unknownUser.status).toBe(404);
    expect(unknownUser.body.error.code).toBe("USER_NOT_FOUND");

    const forbidden = await requester.agent
      .post(`/api/admin/users/${target.id}/initial-password`)
      .set("X-CSRF-Token", requester.csrfToken)
      .send({
        initialPassword: "ReplacementPassword!2",
        confirmInitialPassword: "ReplacementPassword!2",
      });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("USER_MANAGEMENT_FORBIDDEN");
  });
});
