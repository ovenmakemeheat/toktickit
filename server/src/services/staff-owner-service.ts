import type { PrismaClient } from "@prisma/client";

export type StaffOwnerResponse = {
  id: number;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
};

type StaffOwnerStore = Pick<PrismaClient, "user">;

export async function listEligibleStaffOwners(
  prisma: StaffOwnerStore,
): Promise<StaffOwnerResponse[]> {
  const owners = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
    },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return owners.map((owner) => ({
    id: owner.id,
    name: owner.name,
    role: owner.role as "IT_STAFF" | "ADMINISTRATOR",
  }));
}
