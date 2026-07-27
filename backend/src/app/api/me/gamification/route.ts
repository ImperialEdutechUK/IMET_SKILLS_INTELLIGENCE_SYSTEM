import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

// Read-only gamification inputs for the signed-in user: certificate count,
// completed courses and CPD hours. Powers the always-on Level/XP widget in the
// top bar. Only reads User/Certificate/Enrollment/CpdRecord — never the Course
// catalogue.
export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [certificates, coursesCompleted, cpd] = await Promise.all([
    prisma.certificate.count({ where: { userId: authUser.id } }),
    prisma.enrollment.count({ where: { userId: authUser.id, status: "completed" } }),
    prisma.cpdRecord.aggregate({ where: { userId: authUser.id }, _sum: { hours: true } }),
  ]);

  return NextResponse.json({
    certificates,
    coursesCompleted,
    cpdHours: Math.round((cpd._sum.hours ?? 0) * 10) / 10,
  });
}
