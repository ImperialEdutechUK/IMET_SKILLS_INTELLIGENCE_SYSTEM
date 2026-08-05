/**
 * Upload bounds shared by every route that accepts a file.
 *
 * None of the upload endpoints previously checked size or type: a request could
 * carry an arbitrarily large body straight into `Buffer.from(await
 * file.arrayBuffer())` — the whole file is materialised in memory before
 * anything looks at it — and then into SheetJS or pdf-parse. That is a cheap way
 * to exhaust a small Railway dyno, and it is the same code path that feeds a
 * library (`xlsx`) with unfixed prototype-pollution and ReDoS advisories, so
 * bounding what reaches it matters twice over.
 */

/** 10 MB. Comfortably above a real CPD log or certificate, far below trouble. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Extensions the parser actually supports (documentParser.ts). */
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "csv", "xlsx", "xls", "docx", "pdf", "json", "txt", "md",
] as const;

/** Spreadsheet-only routes (CPD log import, LinkedIn export). */
export const ALLOWED_SPREADSHEET_EXTENSIONS = ["csv", "xlsx", "xls", "json"] as const;

export interface UploadCheck {
  ok: boolean;
  error?: string;
}

function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

/**
 * Validate an uploaded `File` before its bytes are read.
 *
 * `file.size` is metadata the client supplies, so it is a fast reject and not
 * the real control — {@link assertBufferSize} re-checks the bytes that actually
 * arrived. Type is decided by extension because that is what `parseDocument`
 * dispatches on; the browser-reported MIME is not trusted for anything.
 */
export function checkUpload(
  file: File,
  allowedExtensions: readonly string[] = ALLOWED_DOCUMENT_EXTENSIONS,
  maxBytes: number = MAX_UPLOAD_BYTES
): UploadCheck {
  if (file.size > maxBytes) {
    return { ok: false, error: `That file is too large. Maximum size is ${Math.floor(maxBytes / (1024 * 1024))} MB.` };
  }

  const name = file.name || "";
  if (name.length > 255) {
    return { ok: false, error: "That file name is too long." };
  }

  const ext = extensionOf(name);
  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      ok: false,
      error: `Unsupported file type. Use one of: ${allowedExtensions.map((e) => `.${e}`).join(", ")}.`,
    };
  }

  return { ok: true };
}

/** The authoritative size check, against the bytes actually received. */
export function checkBufferSize(buffer: Buffer, maxBytes: number = MAX_UPLOAD_BYTES): UploadCheck {
  if (buffer.byteLength > maxBytes) {
    return { ok: false, error: `That file is too large. Maximum size is ${Math.floor(maxBytes / (1024 * 1024))} MB.` };
  }
  return { ok: true };
}
