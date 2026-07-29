// Validation for the proof a learner must supply before a course counts as
// completed: the certificate document itself AND the issuer's verification link.
//
// Both are compulsory. A course is only ever marked complete once this validates,
// so an employee cannot claim CPD hours, XP or a badge tier without evidence.

/** Issuers offered in the dropdown. "Other" lets the learner type their own. */
export const CERTIFICATE_ISSUERS = ["LinkedIn Learning", "Coursera", "edX", "Other"] as const;

// 2.5 MB of file -> ~3.4 MB of base64, plus the data: prefix.
const MAX_FILE_DATA_CHARS = 3_800_000;
const MAX_URL_CHARS = 2_000;

export interface ParsedProof {
  fileUrl: string;
  certificateUrl: string;
  issuer: string | null;
  issuedDate: string | null;
}

/**
 * Validates the certificate payload sent with a "mark complete" request.
 * Returns either the cleaned proof or a learner-facing error message.
 */
export function parseCertificateProof(
  input: unknown
): { ok: true; proof: ParsedProof } | { ok: false; error: string } {
  const body = (input ?? {}) as Record<string, unknown>;

  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  if (!fileUrl) {
    return { ok: false, error: "Upload the certificate PDF or image — it's required." };
  }
  if (!/^data:(application\/pdf|image\/[a-z0-9.+-]+);base64,/i.test(fileUrl)) {
    return { ok: false, error: "The certificate must be a PDF or an image file." };
  }
  if (fileUrl.length > MAX_FILE_DATA_CHARS) {
    return { ok: false, error: "That file is too large. Use a certificate under 2.5 MB." };
  }

  const certificateUrl = typeof body.certificateUrl === "string" ? body.certificateUrl.trim() : "";
  if (!certificateUrl) {
    return { ok: false, error: "Paste the certificate link (URL) — it's required." };
  }
  if (certificateUrl.length > MAX_URL_CHARS || !/^https?:\/\/\S+\.\S+/i.test(certificateUrl)) {
    return { ok: false, error: "Enter a valid certificate link starting with http:// or https://." };
  }

  const issuerRaw = typeof body.issuer === "string" ? body.issuer.trim() : "";
  const issuer = issuerRaw ? issuerRaw.slice(0, 120) : null;

  const dateRaw = typeof body.issuedDate === "string" ? body.issuedDate.trim() : "";
  if (dateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    return { ok: false, error: "Enter the completion date as a real date." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (dateRaw && dateRaw > today) {
    return { ok: false, error: "The completion date can't be in the future." };
  }

  return { ok: true, proof: { fileUrl, certificateUrl, issuer, issuedDate: dateRaw || null } };
}
