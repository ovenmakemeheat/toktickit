import { randomBytes } from "node:crypto";

import request from "supertest";

import { seedLab3Data } from "../../prisma/seed-lab3-data.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import { hashPassword } from "../../src/services/password-service.js";

export const lab3TestPassword =
  process.env.LAB3_TEST_PASSWORD ||
  process.env.LAB3_SEED_PASSWORD ||
  `TestSeed${randomBytes(24).toString("base64url")}A1!`;

export async function prepareLab3Data() {
  await seedLab3Data(prisma, lab3TestPassword);
  const passwordHash = await hashPassword(lab3TestPassword);
  await prisma.session.deleteMany();
  await prisma.user.updateMany({
    data: { passwordHash, mustChangePassword: false },
  });
}

export async function loginAgent(email: string) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/login")
    .send({ email, password: lab3TestPassword });
  if (response.status !== 200) {
    throw new Error(`Unable to authenticate test User ${email}`);
  }
  return {
    agent,
    csrfToken: response.body.csrfToken as string,
    userId: response.body.user.id as number,
  };
}

export async function deleteTickets(ticketIds: Iterable<number>) {
  const ids = [...ticketIds];
  if (ids.length === 0) {
    return;
  }
  await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
}

export { app, prisma };
