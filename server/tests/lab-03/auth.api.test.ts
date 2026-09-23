import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { seedLab3Data } from "../../prisma/seed-lab3-data.js";
import { hashPassword } from "../../src/services/password-service.js";
import { hashSessionToken } from "../../src/services/session-service.js";
import {
  app,
  lab3TestPassword as seedPassword,
  prisma,
} from "./test-helpers.js";

const changedPassword = randomUUID();
const invalidPassword = randomUUID();

function expectError(response: request.Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.objectContaining({ code }),
  });
}

function cookieValue(response: request.Response, name: string) {
  const cookies = response.headers["set-cookie"];
  if (!Array.isArray(cookies)) {
    throw new Error("Missing response cookies");
  }
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Missing ${name} cookie`);
  }
  return decodeURIComponent(
    cookie.slice(name.length + 1).split(";", 1)[0] ?? "",
  );
}

async function login(
  email: string,
  password = seedPassword,
  agent = request.agent(app),
) {
  const response = await agent
    .post("/api/auth/login")
    .send({ email, password });
  expect(response.status).toBe(200);
  expect(response.body.csrfToken).toEqual(expect.any(String));
  expect(response.headers["set-cookie"]).toEqual(
    expect.arrayContaining([
      expect.stringContaining("toktickit_session="),
      expect.stringContaining("toktickit_csrf="),
    ]),
  );
  return {
    agent,
    csrfToken: response.body.csrfToken as string,
    sessionToken: cookieValue(response, "toktickit_session"),
  };
}

beforeAll(async () => {
  await seedLab3Data(prisma, seedPassword);
  await prisma.user.updateMany({
    data: {
      passwordHash: await hashPassword(seedPassword),
      mustChangePassword: true,
    },
  });
});

afterAll(async () => {
  await prisma.session.deleteMany();
  await prisma.user.updateMany({
    data: {
      passwordHash: await hashPassword(seedPassword),
      mustChangePassword: true,
    },
  });
  await prisma.$disconnect();
});

describe("Lab 3 authentication", () => {
  it("returns safe failures for unknown, invalid, and inactive credentials", async () => {
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "unknown@toktickit.test", password: seedPassword });
    const invalid = await request(app).post("/api/auth/login").send({
      email: "requester-a@toktickit.test",
      password: invalidPassword,
    });
    const inactive = await request(app).post("/api/auth/login").send({
      email: "inactive-requester@toktickit.test",
      password: seedPassword,
    });

    expectError(unknown, 401, "INVALID_CREDENTIALS");
    expectError(invalid, 401, "INVALID_CREDENTIALS");
    expectError(inactive, 403, "ACCOUNT_INACTIVE");
    expect(unknown.headers["set-cookie"]).toBeUndefined();
    expect(invalid.headers["set-cookie"]).toBeUndefined();
    expect(inactive.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(unknown.body)).not.toMatch(
      /passwordHash|sessionToken|csrfToken|toktickit_session/i,
    );

    const normalized = await login("  REQUESTER-A@TOKTICKIT.TEST  ");
    expect(normalized.agent).toBeDefined();
  });

  it("requires a session, exposes the current user, and blocks initial-password sessions", async () => {
    const missing = await request(app).get("/api/auth/me");
    expectError(missing, 401, "SESSION_REQUIRED");

    const authenticated = await login("requester-a@toktickit.test");
    expect(authenticated.agent).toBeDefined();
    const me = await authenticated.agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual({
      id: expect.any(Number),
      name: "Requester A",
      email: "requester-a@toktickit.test",
      role: "REQUESTER",
      active: true,
      mustChangePassword: true,
    });
    expect(me.body.session.expiresAt).toEqual(expect.any(String));
    expect(me.body.csrfToken).toEqual(authenticated.csrfToken);

    const blocked = await authenticated.agent.get("/api/categories");
    expectError(blocked, 403, "PASSWORD_CHANGE_REQUIRED");

    const missingCsrf = await authenticated.agent
      .patch("/api/auth/password")
      .send({
        currentPassword: seedPassword,
        newPassword: changedPassword,
        confirmPassword: changedPassword,
      });
    expectError(missingCsrf, 403, "CSRF_TOKEN_INVALID");
  });

  it("changes an initial password, creates a fresh session, and revokes siblings", async () => {
    const first = await login("requester-b@toktickit.test");
    const sibling = await login("requester-b@toktickit.test");
    const oldSession = await prisma.session.findFirstOrThrow({
      where: { tokenHash: hashSessionToken(sibling.sessionToken) },
      select: { id: true },
    });

    const changed = await first.agent
      .patch("/api/auth/password")
      .set("X-CSRF-Token", first.csrfToken)
      .send({
        currentPassword: seedPassword,
        newPassword: changedPassword,
        confirmPassword: changedPassword,
      });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.body.csrfToken).toEqual(expect.any(String));
    expect(changed.body.csrfToken).not.toBe(first.csrfToken);

    const categories = await first.agent.get("/api/categories");
    expect(categories.status).toBe(200);
    expect(categories.body).toEqual(
      expect.arrayContaining([{ id: expect.any(Number), name: "Hardware" }]),
    );

    const revokedSibling = await sibling.agent.get("/api/auth/me");
    expectError(revokedSibling, 401, "SESSION_REQUIRED");
    const revokedCount = await prisma.session.count({
      where: { id: oldSession.id, revokedAt: { not: null } },
    });
    expect(revokedCount).toBe(1);

    const replayLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "requester-b@toktickit.test", password: seedPassword });
    expectError(replayLogin, 401, "INVALID_CREDENTIALS");
    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "requester-b@toktickit.test", password: changedPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(false);
  });

  it("rejects requester identity headers and enforces CSRF origin checks", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", "1")
      .send({});
    expectError(response, 401, "SESSION_REQUIRED");

    await prisma.user.update({
      where: { email: "requester-c@toktickit.test" },
      data: { mustChangePassword: false },
    });
    const authenticated = await login("requester-c@toktickit.test");
    const wrongOrigin = await authenticated.agent
      .post("/api/tickets")
      .set("X-CSRF-Token", authenticated.csrfToken)
      .set("Origin", "https://evil.example")
      .send({});
    expectError(wrongOrigin, 403, "CSRF_TOKEN_INVALID");
  });

  it("rejects expired and inactive sessions without exposing protected data", async () => {
    const expired = await login("requester-a@toktickit.test");
    await prisma.session.update({
      where: { tokenHash: hashSessionToken(expired.sessionToken) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expiredResponse = await expired.agent.get("/api/auth/me");
    expectError(expiredResponse, 401, "SESSION_REQUIRED");

    const inactive = await login("requester-c@toktickit.test");
    await prisma.user.update({
      where: { email: "requester-c@toktickit.test" },
      data: { active: false },
    });
    try {
      const inactiveResponse = await inactive.agent.get("/api/auth/me");
      expectError(inactiveResponse, 401, "SESSION_REQUIRED");
    } finally {
      await prisma.user.update({
        where: { email: "requester-c@toktickit.test" },
        data: { active: true },
      });
    }
  });

  it("rejects role-forbidden requester APIs even with a valid session", async () => {
    await prisma.user.update({
      where: { email: "it-staff-a@toktickit.test" },
      data: { mustChangePassword: false },
    });
    const staff = await login("it-staff-a@toktickit.test");
    const response = await staff.agent.get("/api/tickets");
    expectError(response, 403, "ROLE_FORBIDDEN");
  });

  it("returns safe envelopes for unexpected, malformed, and unknown requests", async () => {
    const sessionLookup = vi
      .spyOn(prisma.session, "findFirst")
      .mockRejectedValueOnce(new Error("database-secret"));
    try {
      const unexpected = await request(app)
        .get("/api/health")
        .set("Cookie", "toktickit_session=unexpected-token");
      expectError(unexpected, 500, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(unexpected.body)).not.toMatch(
        /database-secret|stack|passwordHash/i,
      );
    } finally {
      sessionLookup.mockRestore();
    }

    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expectError(malformed, 400, "INVALID_JSON");

    const notFound = await request(app).get("/api/not-a-real-route");
    expectError(notFound, 404, "NOT_FOUND");
  });

  it("uses route-specific fallbacks for unexpected auth failures", async () => {
    const loginLookup = vi
      .spyOn(prisma.user, "findUnique")
      .mockRejectedValueOnce(new Error("database-secret"));
    try {
      const loginFailure = await request(app)
        .post("/api/auth/login")
        .send({ email: "requester-a@toktickit.test", password: seedPassword });
      expectError(loginFailure, 500, "LOGIN_FAILED");
      expect(JSON.stringify(loginFailure.body)).not.toContain(
        "database-secret",
      );
    } finally {
      loginLookup.mockRestore();
    }

    const authenticated = await login("requester-a@toktickit.test");
    const transaction = vi
      .spyOn(prisma, "$transaction")
      .mockRejectedValueOnce(new Error("database-secret"));
    try {
      const passwordFailure = await authenticated.agent
        .patch("/api/auth/password")
        .set("X-CSRF-Token", authenticated.csrfToken)
        .send({
          currentPassword: seedPassword,
          newPassword: changedPassword,
          confirmPassword: changedPassword,
        });
      expectError(passwordFailure, 500, "PASSWORD_CHANGE_FAILED");
      expect(JSON.stringify(passwordFailure.body)).not.toContain(
        "database-secret",
      );
    } finally {
      transaction.mockRestore();
    }
  });

  it("logs out repeat-safely and prevents reuse of the session", async () => {
    const authenticated = await login("requester-d@toktickit.test");
    const logout = await authenticated.agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", authenticated.csrfToken);
    expect(logout.status).toBe(204);

    const afterLogout = await authenticated.agent.get("/api/auth/me");
    expectError(afterLogout, 401, "SESSION_REQUIRED");
    const repeated = await request(app).post("/api/auth/logout");
    expect(repeated.status).toBe(204);
  });
});
