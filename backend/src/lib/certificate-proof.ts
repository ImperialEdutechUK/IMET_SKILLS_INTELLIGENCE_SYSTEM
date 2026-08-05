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

/** Non-scriptable certificate formats only. Deliberately not `image/*`. */
const ALLOWED_FILE_TYPES = /^data:(application\/pdf|image\/(jpeg|jpg|png|webp));base64,/i;

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
  // An explicit allowlist, not `image/*`. The old pattern accepted any image
  // subtype, which included image/svg+xml — SVG is a scriptable document, and
  // this value is stored and later handed to <img>, to a blob: URL, and to an
  // <a href> that managers and admins click. It is rendered through <img> today,
  // which does not execute embedded script, but that is one refactor away from
  // being untrue and the file has no business being an SVG in the first place.
  if (!ALLOWED_FILE_TYPES.test(fileUrl)) {
    return { ok: false, error: "The certificate must be a PDF, JPEG, PNG or WebP file." };
  }
  if (fileUrl.length > MAX_FILE_DATA_CHARS) {
    return { ok: false, error: "That file is too large. Use a certificate under 2.5 MB." };
  }
  // Reject anything that is not well-formed base64 before it is stored: a
  // malformed payload only fails later, in the browser, as a broken viewer.
  const payload = fileUrl.slice(fileUrl.indexOf(",") + 1);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    return { ok: false, error: "That upload was corrupted. Please try attaching it again." };
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
