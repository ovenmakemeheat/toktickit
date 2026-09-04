import { PrismaClient } from "@prisma/client";

import { seedReferenceData } from "./seed-reference-data.js";

const prisma = new PrismaClient();

seedReferenceData(prisma)
  .then(() => {
    console.log("TokTickIT Lab 2 reference data seeded.");
  })
  .catch((error: unknown) => {
    console.error("TokTickIT seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
