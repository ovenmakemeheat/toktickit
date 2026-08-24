import type { PrismaClient } from "@prisma/client";

import { seedCategories } from "./seed-categories.js";

export const relatedSystemNames = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
] as const;

export const developmentRequesters = [
  {
    name: "Requester A",
    email: "requester-a@toktickit.test",
    active: true,
  },
  {
    name: "Requester B",
    email: "requester-b@toktickit.test",
    active: true,
  },
  {
    name: "Requester C",
    email: "requester-c@toktickit.test",
    active: true,
  },
  {
    name: "Requester D",
    email: "requester-d@toktickit.test",
    active: true,
  },
  {
    name: "Inactive Requester",
    email: "inactive-requester@toktickit.test",
    active: false,
  },
] as const;

type ReferenceSeedStore = Pick<
  PrismaClient,
  "category" | "relatedSystem" | "developmentRequester"
>;

type RelatedSystemStore = Pick<PrismaClient, "relatedSystem">;

type DevelopmentRequesterStore = Pick<PrismaClient, "developmentRequester">;

export async function seedRelatedSystems(prisma: RelatedSystemStore) {
  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true },
    });
  }
}

export async function seedDevelopmentRequesters(
  prisma: DevelopmentRequesterStore,
) {
  for (const requester of developmentRequesters) {
    await prisma.developmentRequester.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        active: requester.active,
      },
      create: requester,
    });
  }
}

export async function seedReferenceData(prisma: ReferenceSeedStore) {
  await seedCategories(prisma);
  await seedRelatedSystems(prisma);
  await seedDevelopmentRequesters(prisma);
}
