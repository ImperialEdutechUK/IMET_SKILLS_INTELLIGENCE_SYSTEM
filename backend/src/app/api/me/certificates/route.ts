import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { packCpd } from "@/lib/cpd-activity";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const certificates = await prisma.certificate.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    certificates: certificates.map((c) => ({
      id: c.id,
      title: c.title,
      issuer: c.issuer,
      issuedDate: c.issuedDate,
      cpdHours: c.cpdHours,
      fileUrl: c.fileUrl,
      status: c.status,
    })),
  });
}

// Manually add / upload a certificate for a course the employee completed.
// Stores the certificate link in Certificate.fileUrl and (optionally) counts the
// hours as CPD so it flows into the employee CPD view and manager/admin tracking.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { title, issuer, cpdHours, issuedDate, fileUrl, addCpd } = body ?? {};
  const cleanTitle = (title ?? "").trim();
  if (!cleanTitle) return NextResponse.json({ error: "Course name is required." }, { status: 400 });

  const hours = typeof cpdHours === "number" && cpdHours > 0 ? cpdHours : 0;
  const date =
    typeof issuedDate === "string" && issuedDate ? issuedDate : new Date().toISOString().slice(0, 10);
  const link = typeof fileUrl === "string" && fileUrl.trim() ? fileUrl.trim() : null;
  const issuedBy = typeof issuer === "string" && issuer.trim() ? issuer.trim() : "Self-reported";

  const existing = await prisma.certificate.findUnique({
    where: { userId_title: { userId: authUser.id, title: cleanTitle } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a certificate with this course name." },
      { status: 409 }
    );
  }

  const cert = await prisma.certificate.create({
    data: {
      userId: authUser.id,
      title: cleanTitle,
      issuer: issuedBy,
      cpdHours: hours,
      issuedDate: date,
      fileUrl: link,
      status: "approved",
    },
  });

  // Optionally count the certificate hours as CPD (source:certificate) so they show
  // up in My CPD and in the manager/admin CPD dashboards.
  if (addCpd && hours > 0) {
    await prisma.cpdRecord.create({
      data: {
        userId: authUser.id,
        certificateId: cert.id,
        hours,
        source: "certificate",
        description: packCpd({
          title: cleanTitle,
          type: "Learning",
          provider: issuedBy,
          category: "Technical Skills",
          dateCompleted: date,
          note: "Certificate uploaded",
        }),
      },
    });
  }

  return NextResponse.json({ ok: true, id: cert.id });
}
