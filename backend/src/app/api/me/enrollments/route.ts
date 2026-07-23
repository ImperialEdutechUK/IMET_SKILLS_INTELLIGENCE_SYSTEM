import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

// Enrol the signed-in employee into a catalog course.
// Creates a not_started enrollment (idempotent per user+course).
// Reads the Course catalog but never writes to it.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { courseId } = body ?? {};
  if (typeof courseId !== "string" || !courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: authUser.id, courseId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, enrollmentId: existing.id, already: true });
  }

  const enrollment = await prisma.enrollment.create({
    data: { userId: authUser.id, courseId, status: "not_started", progress: 0 },
  });
  return NextResponse.json({ ok: true, enrollmentId: enrollment.id });
}
