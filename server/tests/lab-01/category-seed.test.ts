import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { categoryNames, seedCategories } from "../../prisma/seed-categories.js";

const prisma = new PrismaClient();

describe("Issue #15 category seed", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the four categories in a predictable order", async () => {
    await seedCategories(prisma);

    const categories = await prisma.category.findMany({
      where: { name: { in: [...categoryNames] } },
      orderBy: { id: "asc" },
    });

    expect(categories.map((category) => category.name)).toEqual(categoryNames);
    expect(categories.every((category) => category.createdAt)).toBe(true);
  });

  it("does not create duplicates when the seed runs again", async () => {
    await seedCategories(prisma);

    expect(
      await prisma.category.count({
        where: { name: { in: [...categoryNames] } },
      }),
    ).toBe(categoryNames.length);
  });
});
