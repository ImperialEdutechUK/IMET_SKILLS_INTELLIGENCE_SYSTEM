import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

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
      status: c.status,
    })),
  });
}
