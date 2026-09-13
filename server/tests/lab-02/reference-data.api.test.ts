import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  relatedSystemNames,
  seedReferenceData,
} from "../../prisma/seed-reference-data.js";
import { loginAgent, prepareLab3Data, prisma } from "../lab-03/test-helpers.js";

describe("Lab 3 authenticated reference data", () => {
  let authenticated: Awaited<ReturnType<typeof loginAgent>>;

  beforeAll(async () => {
    await prepareLab3Data();
    authenticated = await loginAgent("requester-a@toktickit.test");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns active Related Systems in ascending ID order", async () => {
    const response = await authenticated.agent.get("/api/related-systems");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      relatedSystemNames.map((name) =>
        expect.objectContaining({ id: expect.any(Number), name }),
      ),
    );
    const relatedSystemIds = response.body.map(
      (system: { id: number }) => system.id,
    );
    expect(relatedSystemIds).toEqual(
      [...relatedSystemIds].sort((a, b) => a - b),
    );
  });

  it("keeps the existing four Categories active", async () => {
    const response = await authenticated.agent.get("/api/categories");

    expect(response.status).toBe(200);
    expect(
      response.body.map((category: { name: string }) => category.name),
    ).toEqual(["Account and Access", "Hardware", "Software", "Network"]);
    const categoryIds = response.body.map(
      (category: { id: number }) => category.id,
    );
    expect(categoryIds).toEqual([...categoryIds].sort((a, b) => a - b));
  });

  it("removes the Development Requester identity endpoint", async () => {
    const response = await authenticated.agent.get(
      "/api/development-requesters",
    );
    expect(response.status).toBe(404);
  });

  it("keeps reference seeding repeat-safe", async () => {
    await seedReferenceData(prisma);
    await seedReferenceData(prisma);

    expect(
      await prisma.relatedSystem.count({
        where: { name: { in: [...relatedSystemNames] }, active: true },
      }),
    ).toBe(relatedSystemNames.length);
    expect(await prisma.category.count({ where: { active: true } })).toBe(4);
  });
});
