import type { PrismaClient } from "@prisma/client";

export const categoryNames = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

type CategoryStore = Pick<PrismaClient, "category">;

export async function seedCategories(prisma: CategoryStore) {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true },
    });
  }
}
