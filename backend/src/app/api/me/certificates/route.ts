import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

// Read-only. Certificates are created exclusively by completing a course — either
// "Mark Complete" on an in-progress enrollment or "Add a Course" set to Completed,
// both in POST/PATCH /api/me/enrollments, both requiring the uploaded certificate and
// its verification link. The old manual POST here was a second way in that could mint
// a certificate with no course, no CPD record and no evidence trail behind it; it was
// removed with the "Add Certificate" button on the My Certificates page.
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
      certificateUrl: c.certificateUrl,
      status: c.status,
    })),
  });
}
