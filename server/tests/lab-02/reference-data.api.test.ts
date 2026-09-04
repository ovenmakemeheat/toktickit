import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  developmentRequesters,
  relatedSystemNames,
  seedReferenceData,
} from "../../prisma/seed-reference-data.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";

describe("Issue #52 reference data and Development Requester context", () => {
  beforeAll(async () => {
    await seedReferenceData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns active Development Requesters in ascending ID order", async () => {
    const response = await request(app).get("/api/development-requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      developmentRequesters
        .filter((requester) => requester.active)
        .map(({ name, email }) =>
          expect.objectContaining({ id: expect.any(Number), name, email }),
        ),
    );
    const requesterIds = response.body.map(
      (requester: { id: number }) => requester.id,
    );
    expect(requesterIds).toEqual([...requesterIds].sort((a, b) => a - b));
    expect(response.body).not.toContainEqual(
      expect.objectContaining({ email: "inactive-requester@toktickit.test" }),
    );
  });

  it("returns active Related Systems in ascending ID order", async () => {
    const response = await request(app).get("/api/related-systems");

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
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(
      response.body.map((category: { name: string }) => category.name),
    ).toEqual(["Account and Access", "Hardware", "Software", "Network"]);
    const categoryIds = response.body.map(
      (category: { id: number }) => category.id,
    );
    expect(categoryIds).toEqual([...categoryIds].sort((a, b) => a - b));
  });

  it("is repeat-safe for seeded reference data", async () => {
    await seedReferenceData(prisma);
    await seedReferenceData(prisma);

    expect(
      await prisma.developmentRequester.count({
        where: {
          email: {
            in: developmentRequesters.map((requester) => requester.email),
          },
        },
      }),
    ).toBe(developmentRequesters.length);
    expect(
      await prisma.relatedSystem.count({
        where: { name: { in: [...relatedSystemNames] } },
      }),
    ).toBe(relatedSystemNames.length);
  });
});
