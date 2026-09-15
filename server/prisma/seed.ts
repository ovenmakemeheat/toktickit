import { PrismaClient } from "@prisma/client";

import { env } from "../src/env.js";
import { seedLab3Data } from "./seed-lab3-data.js";

const prisma = new PrismaClient();

seedLab3Data(prisma, env.LAB3_SEED_PASSWORD)
  .then(() => {
    console.log("TokTickIT Lab 3 seed completed.");
  })
  .catch((error: unknown) => {
    console.error("TokTickIT seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
