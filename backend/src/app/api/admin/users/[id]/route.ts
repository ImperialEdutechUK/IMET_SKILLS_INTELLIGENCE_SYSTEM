import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

/**
 * Permanently delete a user and every record they own.
 *
 * Admin-only and irreversible. Every user-owned table is deleted explicitly,
 * children first, inside ONE transaction — deliberately not relying on
 * database-level cascades, so the outcome is the same however the live DB's
 * foreign keys are configured. What goes: enrollments (and their event trail),
 * CPD records, certificates, uploaded documents (DB rows AND the files on
 * disk), skills, skill gaps, recommendations, dislikes, activities,
 * notifications, evaluations, daily reports and password tokens.
 *
 * What deliberately survives:
 *   - The Course catalogue — shared production data, never touched here.
 *   - Shared reference data (skills, categories, role profiles, departments).
 *   - Other users: anyone this person managed keeps their account and is
 *     simply left without a manager.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  // An admin deleting the account they are signed in with would strand the
  // session mid-flight; make them use another admin account for that.
  if (id === authUser.id) {
    return NextResponse.json(
      { error: "You cannot delete the account you are signed in with." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Capture upload paths BEFORE the rows go — after the transaction they are
  // the only remaining pointer to the files on disk.
  const documents = await prisma.document.findMany({
    where: { userId: id },
    select: { storagePath: true },
  });

  await prisma.$transaction(
    async (tx) => {
      // Grandchildren first: rows that hang off the user's enrollments.
      await tx.enrollmentEvent.deleteMany({ where: { enrollment: { userId: id } } });
      // CpdRecord references Enrollment and Certificate, so it goes before both.
      await tx.cpdRecord.deleteMany({ where: { userId: id } });
      await tx.enrollment.deleteMany({ where: { userId: id } });
      await tx.certificate.deleteMany({ where: { userId: id } });
      await tx.passwordToken.deleteMany({ where: { userId: id } });
      await tx.courseDislike.deleteMany({ where: { userId: id } });
      await tx.userSkill.deleteMany({ where: { userId: id } });
      await tx.skillGap.deleteMany({ where: { userId: id } });
      await tx.recommendation.deleteMany({ where: { userId: id } });
      await tx.activity.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.evaluation.deleteMany({ where: { userId: id } });
      await tx.document.deleteMany({ where: { userId: id } });
      await tx.dailyReport.deleteMany({ where: { userId: id } });
      // Direct reports keep their accounts — they just lose the manager link.
      await tx.user.updateMany({ where: { managedBy: id }, data: { managedBy: null } });
      await tx.user.delete({ where: { id } });
    },
    // The DB is remote; each statement is a round trip. Generous limits so a
    // data-rich account cannot hit the default 5s interactive-tx timeout.
    { timeout: 30_000, maxWait: 10_000 }
  );

  // Best effort AFTER the commit: a failed unlink leaves an orphan file, which
  // is recoverable — a failed transaction after unlinking would not be.
  for (const doc of documents) {
    if (doc.storagePath) {
      await fs.unlink(doc.storagePath).catch(() => {
        /* already gone or locked — nothing references it any more */
      });
    }
  }

  return NextResponse.json({ deleted: true, id: user.id, fullName: user.fullName });
}
