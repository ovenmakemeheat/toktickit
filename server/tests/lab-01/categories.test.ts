import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedCategories } from "../../prisma/seed-categories.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";

describe("API-02 category list", () => {
  beforeAll(async () => {
    await seedCategories(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns seeded categories as ID/name pairs in ascending ID order", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);

    const ids = response.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((left, right) => left - right));
  });
});
