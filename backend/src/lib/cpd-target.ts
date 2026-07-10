import { prisma } from "@/lib/db";

export const CPD_TARGET_FALLBACK = 40;

export async function getCpdTargetHours(departmentId: string | null): Promise<number> {
  const year = new Date().getFullYear();

  if (departmentId) {
    const deptTarget = await prisma.cpdTarget.findFirst({
      where: { departmentId, year },
    });
    if (deptTarget) return deptTarget.hoursPerYear;
  }

  const globalTarget = await prisma.cpdTarget.findFirst({
    where: { departmentId: null, year },
  });
  if (globalTarget) return globalTarget.hoursPerYear;

  return CPD_TARGET_FALLBACK;
}
