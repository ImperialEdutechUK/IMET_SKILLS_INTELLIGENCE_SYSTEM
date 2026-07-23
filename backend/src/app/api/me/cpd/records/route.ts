import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { packCpd, CPD_TYPES, CPD_CATEGORIES, type CpdType, type CpdCategory } from "@/lib/cpd-activity";

// Manually record a CPD activity (the Record CPD Activity wizard).
// Covers learning done outside the catalog — never touches the Course catalog.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { title, activityType, provider, dateCompleted, category, hours, note, impact } = body ?? {};
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Activity title is required." }, { status: 400 });
  }
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) {
    return NextResponse.json({ error: "CPD hours must be a positive number." }, { status: 400 });
  }

  const type: CpdType = (CPD_TYPES as readonly string[]).includes(activityType) ? activityType : "Other";
  const cat: CpdCategory = (CPD_CATEGORIES as readonly string[]).includes(category) ? category : "Other";

  const record = await prisma.cpdRecord.create({
    data: {
      userId: authUser.id,
      hours: h,
      source: "manual",
      description: packCpd({
        title: title.trim(),
        type,
        provider: typeof provider === "string" ? provider.trim() || null : null,
        category: cat,
        dateCompleted: typeof dateCompleted === "string" ? dateCompleted : null,
        note: typeof note === "string" ? note.trim() || null : null,
        impact: impact && typeof impact === "object" ? impact : null,
      }),
      loggedAt: typeof dateCompleted === "string" && !isNaN(Date.parse(dateCompleted)) ? new Date(dateCompleted) : new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: record.id });
}
