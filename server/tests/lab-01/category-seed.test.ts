import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { categoryNames, seedCategories } from "../../prisma/seed-categories.js";

const prisma = new PrismaClient();

describe("Issue #15 category seed", () => {
  beforeAll(async () => {
    await prisma.category.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the four categories in a predictable order", async () => {
    await seedCategories(prisma);

    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
    });

    expect(categories.map((category) => category.name)).toEqual(categoryNames);
    expect(categories.every((category) => category.createdAt)).toBe(true);
  });

  it("does not create duplicates when the seed runs again", async () => {
    await seedCategories(prisma);

    expect(await prisma.category.count()).toBe(categoryNames.length);
  });
});
