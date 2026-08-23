import { PrismaClient } from "@prisma/client";

import { seedCategories } from "./seed-categories.js";

const prisma = new PrismaClient();

seedCategories(prisma)
  .then(() => {
    console.log("TokTickIT Lab 1 categories seeded.");
  })
  .catch((error: unknown) => {
    console.error("TokTickIT seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
