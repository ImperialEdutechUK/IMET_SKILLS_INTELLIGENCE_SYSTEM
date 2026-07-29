import { prisma } from "@/lib/db";
import { packCpd } from "@/lib/cpd-activity";

// Idempotent side-effects when an enrollment is completed: the employee earns a
// CPD record (from the course's CPD hours) and an approved certificate. Shared by
// the enrollment PATCH (mark complete) and the manual "I already did this" flow so
// both close the same see-gap -> learn -> log -> CPD loop. Never writes to Course.

export interface CompletionProof {
  /** Uploaded certificate as a data URL (PDF or image) — the viewable artefact. */
  fileUrl: string;
  /** The issuer's verification link. */
  certificateUrl: string;
  /** Issuer chosen by the learner (Coursera, LinkedIn Learning, edX, or their own text). */
  issuer?: string | null;
  /** YYYY-MM-DD the course was completed. Defaults to today. */
  issuedDate?: string | null;
}

interface CertificateOpts {
  userId: string;
  courseTitle: string;
  provider: string | null;
  /** The course's own CPD hours from the catalogue — the default credit. */
  cpdHours: number;
  /**
   * Credit exactly this many hours instead of the course's catalogue figure, and
   * accept 0. Used by "Mark Complete" in My Learning, where CPD must reflect the time
   * the learner actually logged — crediting the catalogue hours on top of the hours
   * they already logged would count the same course twice.
   */
  creditHours?: number;
  /** Certificate the learner uploaded when marking the course complete. */
  proof?: CompletionProof;
}

/** The CPD half additionally needs the enrollment the hours hang off. */
interface CompletionOpts extends CertificateOpts {
  enrollmentId: string;
}

// Hours to credit: an explicit creditHours wins (0 is a valid answer); otherwise the
// course's CPD hours, floored at 1 so a catalogue row with no CPD figure still counts.
const creditFor = (opts: CertificateOpts) =>
  opts.creditHours !== undefined
    ? Math.max(0, opts.creditHours)
    : opts.cpdHours > 0
      ? opts.cpdHours
      : 1;

/**
 * Issue (or top up) the certificate for a completed course.
 *
 * Exposed separately from the CPD half so the "mark complete" route can run it
 * BEFORE flipping the enrollment to completed: if the certificate can't be written,
 * the request fails with the course still In Progress rather than leaving a
 * completed course with no evidence behind it.
 */
export async function issueCompletionCertificate(opts: CertificateOpts): Promise<void> {
  const proof = opts.proof;
  const today = new Date().toISOString().slice(0, 10);
  // The learner never re-types CPD hours — the certificate carries whatever this
  // completion credits (for "Mark Complete", the hours they logged), so the figure on
  // the certificate card always matches the CPD actually banked.
  const hours = creditFor(opts);
  const issuedDate = proof?.issuedDate || today;
  const issuer = proof?.issuer?.trim() || opts.provider || "LearnSmart AI";

  // userId + title is unique
  const existing = await prisma.certificate.findUnique({
    where: { userId_title: { userId: opts.userId, title: opts.courseTitle } },
  });
  if (!existing) {
    await prisma.certificate.create({
      data: {
        userId: opts.userId,
        title: opts.courseTitle,
        issuer,
        cpdHours: hours,
        issuedDate,
        fileUrl: proof?.fileUrl ?? null,
        certificateUrl: proof?.certificateUrl ?? null,
        status: "approved",
      },
    });
  } else if (proof) {
    // Re-completing a course the learner had already earned a certificate for: attach
    // the freshly uploaded proof rather than silently discarding it. Only fills the
    // proof fields — the original issue date and CPD hours stand.
    await prisma.certificate.update({
      where: { id: existing.id },
      data: { fileUrl: proof.fileUrl, certificateUrl: proof.certificateUrl, issuer },
    });
  }
}

/**
 * Credit CPD hours for a completed enrollment. No-op when the enrollment already has
 * a CPD record (e.g. the learner logged hours as they went) — those hours are already
 * banked and must not be topped up — or when there is nothing to credit.
 */
export async function logCompletionCpd(opts: CompletionOpts): Promise<void> {
  const hours = creditFor(opts);
  if (hours <= 0) return;

  // enrollmentId is unique -> at most one CPD record per enrollment
  const existing = await prisma.cpdRecord.findUnique({ where: { enrollmentId: opts.enrollmentId } });
  if (existing) return;

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
        dateCompleted: new Date().toISOString().slice(0, 10),
        note: "Completed course",
      }),
    },
  });
}

/** Both completion side-effects, in the order that avoids double-counting CPD. */
export async function applyEnrollmentCompletion(opts: CompletionOpts): Promise<void> {
  await logCompletionCpd(opts);
  await issueCompletionCertificate(opts);
}
