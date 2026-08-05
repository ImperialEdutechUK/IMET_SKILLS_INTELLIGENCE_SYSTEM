"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileText, X } from "lucide-react";

// The learner's certificate shelf: a list of what they've earned, and a viewer that
// opens the ACTUAL uploaded document (the data URL saved at completion) rather than
// a stylised stand-in. Review status is deliberately not surfaced here — a learner
// only ever sees their own certificates, and an "Approved/Pending" chip on a
// document they already hold reads as a verdict on their achievement.

export interface GalleryCertificate {
  id: string;
  title: string;
  issuer: string;
  issuedDate: string;
  cpdHours: number;
  fileUrl: string | null;
  certificateUrl: string | null;
}

type Kind = "pdf" | "image" | "none";

/** What the stored artefact actually is, so we render it with the right element. */
function fileKind(fileUrl: string | null): Kind {
  if (!fileUrl) return "none";
  const head = fileUrl.slice(0, 64).toLowerCase();
  if (head.startsWith("data:")) {
    if (head.includes("application/pdf")) return "pdf";
    if (head.includes("image/")) return "image";
    return "pdf";
  }
  const path = fileUrl.split(/[?#]/)[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(path)) return "image";
  return "pdf"; // .pdf and anything unknown — the frame handles both.
}

/** Certificate titles are often the uploaded file's name; the extension is noise. */
function displayTitle(title: string) {
  return title.replace(/\.(pdf|png|jpe?g|gif|webp|avif|bmp)$/i, "");
}

function formatDate(value: string) {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Chrome refuses to navigate a frame to a `data:` URL, so a stored PDF can only be
 * displayed once it's been turned back into a blob. Images are exempt — `<img>`
 * reads a data URL directly — but going through the same blob keeps the download
 * button pointed at a single, correctly-typed source.
 */
function useDocumentUrl(fileUrl: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) { setUrl(null); return; }
    if (!fileUrl.startsWith("data:")) { setUrl(fileUrl); return; }

    let objectUrl: string | null = null;
    try {
      const comma = fileUrl.indexOf(",");
      const meta = fileUrl.slice(5, comma);
      const mime = meta.split(";")[0] || "application/octet-stream";
      const binary = atob(fileUrl.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      setUrl(objectUrl);
    } catch {
      setUrl(null); // Corrupt or truncated upload — the viewer falls back below.
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileUrl]);

  return url;
}

export default function CertificateGallery({ certificates }: { certificates: GalleryCertificate[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Your certificates</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Click a certificate to open and view it.</p>
      </div>

      <ul className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        {certificates.map((cert, i) => (
          <li key={cert.id} className="border-b border-[var(--border)] last:border-0">
            <CertificateRow cert={cert} onOpen={() => setOpenIndex(i)} />
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <CertificateViewer
          certificates={certificates}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

function CertificateRow({ cert, onOpen }: { cert: GalleryCertificate; onOpen: () => void }) {
  const kind = fileKind(cert.fileUrl);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-[var(--brand-tint)] focus:outline-none focus-visible:bg-[var(--brand-tint)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] sm:px-5"
    >
      <Thumbnail cert={cert} kind={kind} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--brand-dark)]">
          {displayTitle(cert.title)}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
          {cert.issuer} · {formatDate(cert.issuedDate)}
          {cert.cpdHours > 0 && <span className="font-medium text-[var(--brand-dark)]"> · +{cert.cpdHours} CPD</span>}
        </p>
      </div>

      {/* Reveals on hover so a resting row stays quiet, but the row still reads as
          clickable at a glance thanks to the chevron. */}
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--brand)] px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
        View <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
    </button>
  );
}

function Thumbnail({ cert, kind }: { cert: GalleryCertificate; kind: Kind }) {
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
      {kind === "image" && cert.fileUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, not a remote asset
        <img src={cert.fileUrl} alt="" className="h-full w-full object-cover" />
      ) : kind === "none" ? (
        // No document behind this one — don't imply there's a file to look at.
        <FileText className="h-5 w-5 text-white/70" />
      ) : (
        <span className="flex flex-col items-center gap-0.5 text-white">
          <FileText className="h-4 w-4" />
          <span className="text-[8px] font-bold tracking-wider">PDF</span>
        </span>
      )}
      {/* Sits over whichever of the three the row is showing. */}
      <span className="absolute inset-0 grid place-items-center bg-[var(--brand-dark)]/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Eye className="h-4 w-4 text-white" />
      </span>
    </span>
  );
}

/**
 * The document viewer on its own, so anyone entitled to look at a certificate
 * opens it the same way — the learner from their shelf, a manager from the
 * employee drill-down. Kept free of learner-only wording for that reason.
 */
export function CertificateViewer({
  certificates,
  index,
  onIndexChange,
  onClose,
}: {
  certificates: GalleryCertificate[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const cert = certificates[index];
  const kind = fileKind(cert.fileUrl);
  const docUrl = useDocumentUrl(cert.fileUrl);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < certificates.length) onIndexChange(next);
    },
    [index, certificates.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    // The document frame is tall; letting the page behind it scroll too is jarring.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  const fileName = useMemo(() => {
    const base = displayTitle(cert.title).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "certificate";
    return `${base}.${kind === "image" ? "png" : "pdf"}`;
  }, [cert.title, kind]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--ink)]/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Certificate: ${displayTitle(cert.title)}`}
    >
      <div
        className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-[var(--ink)]">{displayTitle(cert.title)}</h3>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {cert.issuer} · {formatDate(cert.issuedDate)}
              {cert.cpdHours > 0 && <span className="font-medium text-[var(--brand-dark)]"> · +{cert.cpdHours} CPD</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cert.certificateUrl && (
              <a
                href={cert.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Verify
              </a>
            )}
            {docUrl && (
              <a
                href={docUrl}
                download={fileName}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-dark)]"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:bg-slate-50 hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* The document itself, on a tinted stage so a white certificate has an edge. */}
        <div className="bg-[var(--page)] p-4 sm:p-6">
          <DocumentFrame kind={kind} url={docUrl} fileUrl={cert.fileUrl} certificateUrl={cert.certificateUrl} />
        </div>

        {certificates.length > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-xs text-[var(--muted)]">{index + 1} of {certificates.length}</span>
            <button
              onClick={() => go(1)}
              disabled={index === certificates.length - 1}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] disabled:pointer-events-none disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentFrame({
  kind,
  url,
  fileUrl,
  certificateUrl,
}: {
  kind: Kind;
  url: string | null;
  fileUrl: string | null;
  certificateUrl: string | null;
}) {
  if (kind === "image" && fileUrl) {
    return (
      <div className="grid max-h-[70vh] place-items-center overflow-auto rounded-xl border border-[var(--border)] bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a remote asset */}
        <img src={fileUrl} alt="Uploaded certificate" className="max-h-[66vh] w-auto max-w-full object-contain" />
      </div>
    );
  }

  if (kind === "pdf" && url) {
    // Without the fragment the browser's own PDF chrome loads on top of ours —
    // in Edge that's a toolbar of drawing and read-aloud tools inside the modal.
    // Suppressing it leaves just the page; downloading is our header's job.
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0&statusbar=0&view=Fit`}
        title="Uploaded certificate"
        className="h-[70vh] w-full rounded-xl border border-[var(--border)] bg-white"
      />
    );
  }

  // No file saved (certificates predating the upload requirement), or the stored
  // data URL could not be decoded. The verification link is all we can offer.
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] bg-white p-10 text-center">
      <FileText className="h-8 w-8 text-[var(--muted)]" />
      <p className="mt-3 text-sm font-medium text-[var(--ink)]">No certificate document was saved for this one.</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--muted)]">
        It was recorded before uploads were required. {certificateUrl ? "You can still check it at the issuer." : ""}
      </p>
      {certificateUrl && (
        <a
          href={certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-dark)]"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open at the issuer
        </a>
      )}
    </div>
  );
}
