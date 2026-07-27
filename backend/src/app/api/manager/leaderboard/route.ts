import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

// Read-only team XP leaderboard. Tallies each employee's gamification inputs
// (certificates, completed courses, CPD hours) into XP and ranks them. It only
// reads User/Certificate/Enrollment/CpdRecord — the Course catalogue is never
// touched. Department-scoped server-side, like the other manager endpoints.

// Mirror of frontend/src/lib/gamification.ts so ranks match the widgets exactly.
const XP_PER_CERTIFICATE = 100;
const XP_PER_COURSE = 50;
const XP_PER_CPD_HOUR = 10;
const XP_PER_LEVEL = 500;
const LEVEL_TITLES = ["Rookie", "Explorer", "Achiever", "Specialist", "Expert", "Master", "Legend"];

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (authUser.role !== "manager") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const departmentId = authUser.departmentId;

  const members = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    select: {
      id: true,
      fullName: true,
      position: true,
      _count: { select: { certificates: true } },
      enrollments: { where: { status: "completed" }, select: { id: true } },
      cpdRecords: { select: { hours: true } },
    },
  });

  const rows = members
    .map((m) => {
      const certCount = m._count.certificates;
      const coursesCompleted = m.enrollments.length;
      const cpdHours = Math.round(m.cpdRecords.reduce((s, r) => s + r.hours, 0) * 10) / 10;
      const xp =
        certCount * XP_PER_CERTIFICATE +
        coursesCompleted * XP_PER_COURSE +
        Math.round(cpdHours) * XP_PER_CPD_HOUR;
      const level = Math.floor(xp / XP_PER_LEVEL) + 1;
      const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
      return { id: m.id, fullName: m.fullName, position: m.position ?? "—", certCount, coursesCompleted, cpdHours, xp, level, title };
    })
    .sort((a, b) => b.xp - a.xp)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return NextResponse.json({ members: rows, totalXp: rows.reduce((s, r) => s + r.xp, 0) });
}
