import type { PrismaClient } from "@prisma/client";

type CategoryStore = Pick<PrismaClient, "category">;

export class CategoryStoreUnavailableError extends Error {
  readonly code = "CATEGORY_STORE_UNAVAILABLE";

  constructor(cause: unknown) {
    super("Unable to load categories", { cause });
    this.name = "CategoryStoreUnavailableError";
  }
}

export async function listCategories(prisma: CategoryStore) {
  try {
    return await prisma.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
  } catch (cause) {
    throw new CategoryStoreUnavailableError(cause);
  }
}
