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
   * accept 0. This is how a caller states the learner's OWN figure — the hours they
   * typed on a self-reported course, or `completionCpdHours()` for "Mark Complete",
   * which honours their corrected course length over the scraped catalogue value.
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
  } else if (proof || existing.cpdHours !== hours) {
    // Re-completing a course the learner had already earned a certificate for: attach
    // the freshly uploaded proof rather than silently discarding it, and re-state the
    // hours.
    //
    // Syncing cpdHours matters: a certificate issued from the catalogue's estimate
    // used to keep that estimate forever while the CPD ledger banked something else,
    // so the certificate card and the CPD total disagreed (16h on the card, 4h in the
    // ledger). The completion credit is the single figure both must show.
    await prisma.certificate.update({
      where: { id: existing.id },
      data: {
        cpdHours: hours,
        issuer,
        ...(proof ? { fileUrl: proof.fileUrl, certificateUrl: proof.certificateUrl } : {}),
      },
    });
  }
}

/**
 * Credit CPD hours for a completed enrollment, and return the hours ADDED to the
 * learner's ledger by this call (0 when nothing changed).
 *
 * A learner who logged hours as they went already has a CPD record on this
 * enrollment holding those partial hours. Completing the course must TOP THAT UP to
 * the course's full value — it must not no-op, which is what silently under-credited
 * every learner who logged as they went (4h banked against an 8h course they
 * finished). One record per enrollment (enrollmentId is unique), so topping up can
 * never double-count: the record is set to the completion credit, not increased by it.
 *
 * Never lowers a record — hours already banked are never taken away here.
 *
 * Used by the "I already did this course" flow, where the learner TYPES the hours and
 * that figure is authoritative. The enrollment PATCH takes the other path
 * (setEnrollmentCpd), which states the exact target instead of raising toward one.
 */
export async function logCompletionCpd(opts: CompletionOpts): Promise<number> {
  const hours = creditFor(opts);
  if (hours <= 0) return 0;

  // enrollmentId is unique -> at most one CPD record per enrollment
  const existing = await prisma.cpdRecord.findUnique({ where: { enrollmentId: opts.enrollmentId } });

  if (existing) {
    const topUp = Math.round((hours - existing.hours) * 100) / 100;
    if (topUp <= 0) return 0;
    await prisma.cpdRecord.update({
      where: { enrollmentId: opts.enrollmentId },
      // loggedAt moves to now — the top-up is earned on the completion date, and for a
      // record with no activity trail behind it that timestamp is all the period-scoped
      // figures have to go on.
      data: { hours, loggedAt: new Date() },
    });
    return topUp;
  }

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
  return hours;
}

/**
 * Set an enrollment's CPD to exactly `hours`, creating the record if needed.
 *
 * This is the ONE write the enrollment PATCH makes to the ledger, replacing three
 * separate blocks that each nudged the number by a delta (log hours → add; complete →
 * top up; reopen → subtract). Deltas made the outcome depend on the order and on how
 * many times a request had run; stating the target instead makes the whole PATCH
 * idempotent and double-counting structurally impossible, in either direction:
 *
 *   completed → the course's full value (completionCpdHours)
 *   otherwise → the hours actually logged
 *
 * Returns the signed change applied, which the caller records on the activity trail.
 */
export async function setEnrollmentCpd(opts: {
  userId: string;
  enrollmentId: string;
  courseTitle: string;
  provider: string | null;
  hours: number;
}): Promise<number> {
  const next = Math.round(Math.max(0, opts.hours) * 100) / 100;
  const existing = await prisma.cpdRecord.findUnique({ where: { enrollmentId: opts.enrollmentId } });

  if (existing) {
    if (existing.hours === next) return 0;
    await prisma.cpdRecord.update({
      where: { enrollmentId: opts.enrollmentId },
      // loggedAt moves only when CPD is EARNED, never when it is given back, so the
      // date always marks the most recent moment this course added to the ledger.
      data: { hours: next, ...(next > existing.hours ? { loggedAt: new Date() } : {}) },
    });
    return Math.round((next - existing.hours) * 100) / 100;
  }

  if (next <= 0) return 0;
  await prisma.cpdRecord.create({
    data: {
      userId: opts.userId,
      enrollmentId: opts.enrollmentId,
      hours: next,
      source: "course",
      description: packCpd({
        title: opts.courseTitle,
        type: "Learning",
        provider: opts.provider,
        category: "Technical Skills",
        dateCompleted: new Date().toISOString().slice(0, 10),
        note: "Time logged",
      }),
    },
  });
  return next;
}

/** Both completion side-effects, in the order that avoids double-counting CPD. */
export async function applyEnrollmentCompletion(opts: CompletionOpts): Promise<void> {
  await logCompletionCpd(opts);
  await issueCompletionCertificate(opts);
}
