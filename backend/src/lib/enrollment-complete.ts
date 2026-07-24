import { prisma } from "@/lib/db";
import { packCpd } from "@/lib/cpd-activity";

// Idempotent side-effects when an enrollment is completed: the employee earns a
// CPD record (from the course's CPD hours) and an approved certificate. Shared by
// the enrollment PATCH (mark complete) and the manual "I already did this" flow so
// both close the same see-gap -> learn -> log -> CPD loop. Never writes to Course.
export async function applyEnrollmentCompletion(opts: {
  userId: string;
  enrollmentId: string;
  courseTitle: string;
  provider: string | null;
  cpdHours: number;
}): Promise<void> {
  const hours = opts.cpdHours && opts.cpdHours > 0 ? opts.cpdHours : 1;
  const today = new Date().toISOString().slice(0, 10);

  // CPD record (enrollmentId is unique -> at most one per enrollment)
  const existingCpd = await prisma.cpdRecord.findUnique({ where: { enrollmentId: opts.enrollmentId } });
  if (!existingCpd) {
    await prisma.cpdRecord.create({
      data: {
        userId: opts.userId,
        enrollmentId: opts.enrollmentId,
        hours,
        source: "course",
        description: packCpd({
          title: opts.courseTitle,
          type: "Learning",
          provider: opts.provider,
          category: "Technical Skills",
          dateCompleted: today,
          note: "Completed course",
        }),
      },
    });
  }

  // Certificate (userId + title is unique)
  const existingCert = await prisma.certificate.findUnique({
    where: { userId_title: { userId: opts.userId, title: opts.courseTitle } },
  });
  if (!existingCert) {
    await prisma.certificate.create({
      data: {
        userId: opts.userId,
        title: opts.courseTitle,
        issuer: opts.provider ?? "LearnSmart AI",
        cpdHours: hours,
        issuedDate: today,
        status: "approved",
      },
    });
  }
}
