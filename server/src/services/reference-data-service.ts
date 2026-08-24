import type { PrismaClient } from "@prisma/client";

type CategoryStore = Pick<PrismaClient, "category">;
type RelatedSystemStore = Pick<PrismaClient, "relatedSystem">;
type DevelopmentRequesterStore = Pick<PrismaClient, "developmentRequester">;

export class ReferenceDataStoreUnavailableError extends Error {
  readonly code = "REFERENCE_DATA_UNAVAILABLE";

  constructor(cause: unknown) {
    super("Reference data is unavailable", { cause });
    this.name = "ReferenceDataStoreUnavailableError";
  }
}

export async function listCategories(prisma: CategoryStore) {
  try {
    return await prisma.category.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
  } catch (cause) {
    throw new ReferenceDataStoreUnavailableError(cause);
  }
}

export async function listRelatedSystems(prisma: RelatedSystemStore) {
  try {
    return await prisma.relatedSystem.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
  } catch (cause) {
    throw new ReferenceDataStoreUnavailableError(cause);
  }
}

export async function listDevelopmentRequesters(
  prisma: DevelopmentRequesterStore,
) {
  try {
    return await prisma.developmentRequester.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true },
    });
  } catch (cause) {
    throw new ReferenceDataStoreUnavailableError(cause);
  }
}
