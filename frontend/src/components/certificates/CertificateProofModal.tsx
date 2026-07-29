"use client";

import { useState } from "react";
import { X, Upload, FileText } from "lucide-react";

// One dialog for every "prove you finished this" moment in the app: adding a
// certificate by hand, and marking an in-progress course complete. Both need the
// same evidence — the certificate document AND the issuer's verification link —
// so they share this form rather than drifting apart.
//
// CPD hours are deliberately absent: a course already carries its own CPD hours,
// and the learner should never have to re-type them.

/** Issuers offered in the dropdown — mirrors CERTIFICATE_ISSUERS on the backend. */
export const ISSUERS = ["LinkedIn Learning", "Coursera", "edX", "Other"] as const;
export type Issuer = (typeof ISSUERS)[number];

/** Maps a course's free-text provider onto one of the dropdown options. */
export function matchIssuer(provider: string | null | undefined): Issuer {
  const p = (provider ?? "").toLowerCase();
  if (p.includes("linkedin")) return "LinkedIn Learning";
  if (p.includes("coursera")) return "Coursera";
  if (p.includes("edx")) return "edX";
  return "Other";
}

export interface CertificatePayload {
  title: string;
  issuer: string;
  /** Uploaded PDF/image as a data URL. */
  fileUrl: string;
  /** The issuer's verification link. */
  certificateUrl: string;
  /** YYYY-MM-DD, or "" if left blank. */
  issuedDate: string;
}

const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

/**
 * The upload control on its own, so any form that needs proof of completion (this
 * modal, "Add a Course" set to Completed) reads the file the same way: same formats,
 * same size cap, same data-URL shape the backend validates.
 */
export function CertificateFileField({
  fileName,
  onPicked,
  onError,
}: {
  fileName: string;
  /** Empty strings when the learner clears their choice. */
  onPicked: (dataUrl: string, name: string) => void;
  onError: (message: string) => void;
}) {
  const handle = (file: File | undefined) => {
    onError("");
    if (!file) { onPicked("", ""); return; }
    if (file.size > MAX_BYTES) { onError("File must be under 2.5 MB. Try a smaller PDF or image."); return; }
    const reader = new FileReader();
    reader.onload = () => onPicked(String(reader.result), file.name);
    reader.onerror = () => onError("Could not read that file.");
    reader.readAsDataURL(file); // -> data:application/pdf;base64,…
  };

  if (fileName) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--ink)]">
          <FileText className="h-4 w-4 shrink-0 text-[var(--brand-dark)]" />
          <span className="truncate">{fileName}</span>
        </span>
        <button type="button" onClick={() => handle(undefined)} aria-label="Remove file" className="shrink-0 text-[var(--muted)] hover:text-red-600"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--ink)]">
      <Upload className="h-4 w-4" /> Choose a PDF or image (max 2.5 MB)
      <input type="file" accept="application/pdf,image/*" className="hidden"
        onChange={(e) => handle(e.target.files?.[0])} />
    </label>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
    </div>
  );
}

export default function CertificateProofModal({
  heading,
  intro,
  submitLabel,
  initialTitle = "",
  titleLocked = false,
  initialProvider = null,
  onSubmit,
  onClose,
}: {
  heading: string;
  intro?: string;
  submitLabel: string;
  initialTitle?: string;
  /** True when the course name comes from the enrollment and must not be edited. */
  titleLocked?: boolean;
  initialProvider?: string | null;
  /** Returns an error message to display, or null when the save succeeded. */
  onSubmit: (payload: CertificatePayload) => Promise<string | null>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [issuer, setIssuer] = useState<Issuer>(matchIssuer(initialProvider));
  // Only used when "Other" is selected; pre-filled with the provider we couldn't map.
  const [otherIssuer, setOtherIssuer] = useState(
    matchIssuer(initialProvider) === "Other" ? (initialProvider ?? "") : ""
  );
  const [certificateUrl, setCertificateUrl] = useState("");
  const [fileData, setFileData] = useState("");
  const [fileName, setFileName] = useState("");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim()) { setError("Course name is required."); return; }
    if (!fileData) { setError("Upload the certificate PDF or image — it's required."); return; }
    if (!certificateUrl.trim()) { setError("Paste the certificate link (URL) — it's required."); return; }
    if (issuer === "Other" && !otherIssuer.trim()) { setError("Name the issuer / provider."); return; }
    setSaving(true); setError("");
    const message = await onSubmit({
      title: title.trim(),
      issuer: issuer === "Other" ? otherIssuer.trim() : issuer,
      fileUrl: fileData,
      certificateUrl: certificateUrl.trim(),
      issuedDate,
    });
    if (message) { setError(message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-auto w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-[var(--ink)]">{heading}</h2>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
        </div>
        {intro && <p className="mb-4 text-xs leading-relaxed text-[var(--muted)]">{intro}</p>}

        <div className="space-y-4">
          <Field label="Course name" required>
            {titleLocked ? (
              <div className="truncate rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm font-medium text-[var(--ink)]">{title}</div>
            ) : (
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AWS Certified Solutions Architect"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
            )}
          </Field>

          <Field label="Issuer / Provider" required>
            <select value={issuer} onChange={(e) => setIssuer(e.target.value as Issuer)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
              {ISSUERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {issuer === "Other" && (
              <input value={otherIssuer} onChange={(e) => setOtherIssuer(e.target.value)} placeholder="Name the issuer, e.g. Udemy"
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
            )}
          </Field>

          <Field label="Upload certificate (PDF or image)" required>
            <CertificateFileField
              fileName={fileName}
              onPicked={(data, name) => { setFileData(data); setFileName(name); }}
              onError={setError}
            />
          </Field>

          <Field label="Certificate link (URL)" required>
            <input value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} placeholder="https://…"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>

          <Field label="Date completed">
            <input value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} type="date" max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>

          <p className="text-xs text-[var(--muted)]">Both the certificate file and its link are required.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
