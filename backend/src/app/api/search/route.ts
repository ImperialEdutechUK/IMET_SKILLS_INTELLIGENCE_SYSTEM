import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { excludeTestAccounts } from "@/lib/test-accounts";

// Global search behind the top-bar box. Read-only across three entities, scoped
// by role: everyone can find courses and skills; only managers (locked to their
// own department) and admins can find people. No writes and no schema changes —
// safe against the scraped-course catalogue.
const LIMIT = 6;

type PersonRow = {
  id: string;
  fullName: string;
  email: string;
  position: string | null;
  department: { name: string } | null;
};

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  // Require two characters so a single keystroke never scans the whole catalogue.
  if (q.length < 2) {
    return NextResponse.json({ query: q, role: authUser.role, courses: [], skills: [], people: [] });
  }

  const like = { contains: q, mode: "insensitive" as const };
  const canSearchPeople = authUser.role === "manager" || authUser.role === "admin";

  const [courses, skills, peopleRaw] = await Promise.all([
    prisma.course.findMany({
      where: { OR: [{ title: like }, { provider: like }] },
      select: { id: true, title: true, provider: true, level: true, externalUrl: true, category: { select: { name: true } } },
      orderBy: { title: "asc" },
      take: LIMIT,
    }),
    prisma.skill.findMany({
      where: { name: like },
      select: { id: true, name: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),
    canSearchPeople
      ? prisma.user.findMany({
          where: {
            role: "employee",
            // Managers are locked to their own department, server-side.
            ...(authUser.role === "manager" && authUser.departmentId ? { departmentId: authUser.departmentId } : {}),
            OR: [{ fullName: like }, { email: like }, { position: like }],
          },
          select: { id: true, fullName: true, email: true, position: true, department: { select: { name: true } } },
          orderBy: { fullName: "asc" },
          take: LIMIT + 4,
        })
      : Promise.resolve([] as PersonRow[]),
  ]);

  // Seeded test/onboarding accounts never surface as real people.
  const people = excludeTestAccounts(peopleRaw).slice(0, LIMIT);

  return NextResponse.json({ query: q, role: authUser.role, courses, skills, people });
}
