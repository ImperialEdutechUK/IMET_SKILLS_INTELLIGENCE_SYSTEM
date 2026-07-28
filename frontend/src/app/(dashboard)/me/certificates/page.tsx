"use client";

import { useEffect, useState } from "react";
import { Award, Plus, ExternalLink, X, Upload, FileText } from "lucide-react";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import AchievementsBento from "@/components/gamification/AchievementsBento";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Certificate {
  id: string;
  title: string;
  issuer: string;
  issuedDate: string;
  cpdHours: number;
  fileUrl: string | null;
  status: string;
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  // Completed courses + CPD hours also feed XP, so the game state here matches
  // the dashboard exactly (same computeGamification inputs everywhere).
  const [stats, setStats] = useState({ coursesCompleted: 0, cpdHours: 0 });

  const load = () => {
    fetch(`${API}/api/me/certificates`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCertificates(d.certificates); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetch(`${API}/api/me/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStats({ coursesCompleted: d.completedCount ?? 0, cpdHours: d.cpdHours ?? 0 }); })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon3D icon={Award} tone={TONES.violet} />
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">My Certificates</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Your earned certificates. Add certificates from courses you completed elsewhere and attach the link.</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          <Plus className="h-4 w-4" /> Add Certificate
        </button>
      </div>

      {!loading && <AchievementsBento certificates={certificates.length} coursesCompleted={stats.coursesCompleted} cpdHours={stats.cpdHours} />}

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : certificates.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <div className="mx-auto w-fit"><Icon3D icon={Award} tone={TONES.violet} /></div>
          <p className="mt-3 text-sm font-medium text-[var(--ink)]">No certificates yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Completing a course earns one automatically, or add one manually with its link.</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add Certificate
          </button>
        </div>
      ) : (
        <>
        <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Your certificates</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex items-start justify-between">
                <Icon3D icon={Award} tone={TONES.violet} />
                <StatusBadge status={cert.status} />
              </div>
              <h3 className="mt-4 font-semibold text-[var(--ink)]">{cert.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{cert.issuer}</p>
              <div className="mt-3">
                <span className="text-xs text-[var(--muted)]">{cert.issuedDate}</span>
              </div>
              {cert.fileUrl && (
                <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                  <ExternalLink className="h-3.5 w-3.5" /> View Certificate
                </a>
              )}
            </div>
          ))}
        </div>
        </>
      )}

      {showAdd && <AddCertificateModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); setLoading(true); load(); }} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    rejected: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

function AddCertificateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileData, setFileData] = useState("");   // uploaded PDF/image as a data URL
  const [fileName, setFileName] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
  const handleFile = (file: File | undefined) => {
    setError("");
    if (!file) { setFileData(""); setFileName(""); return; }
    if (file.size > MAX_BYTES) { setError("File must be under 2.5 MB. Try a smaller PDF, or paste a link instead."); return; }
    const reader = new FileReader();
    reader.onload = () => { setFileData(String(reader.result)); setFileName(file.name); };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file); // -> data:application/pdf;base64,...
  };

  const submit = async () => {
    // Both proofs are compulsory: the uploaded certificate PDF/image AND its link.
    if (!title.trim()) { setError("Course name is required."); return; }
    if (!fileData) { setError("Upload the certificate PDF or image — it's required."); return; }
    if (!fileUrl.trim()) { setError("Paste the certificate link (URL) — it's required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/api/me/certificates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          issuer: issuer.trim() || undefined,
          // The uploaded file is the viewable certificate (opened by "View Certificate").
          fileUrl: fileData,
          issuedDate: issuedDate || undefined,
        }),
      });
      if (r.ok) { onSaved(); return; }
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Could not save the certificate.");
    } catch {
      setError("Could not save the certificate.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/85 p-6 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)]">Add Certificate</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Course name" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AWS Certified Solutions Architect"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>
          <Field label="Issuer / Provider">
            <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="e.g. Amazon, Coursera, LinkedIn"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>
          <Field label="Upload certificate (PDF or image)" required>
            {fileName ? (
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--ink)]">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--brand-dark)]" />
                  <span className="truncate">{fileName}</span>
                </span>
                <button type="button" onClick={() => handleFile(undefined)} className="shrink-0 text-[var(--muted)] hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--ink)]">
                <Upload className="h-4 w-4" /> Choose a PDF or image (max 2.5 MB)
                <input type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            )}
          </Field>
          <Field label="Certificate link (URL)" required>
            <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>
          <Field label="Date completed">
            <input value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} type="date"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>
          <p className="text-xs text-[var(--muted)]">Both the certificate file and its link are required.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">{saving ? "Saving…" : "Add Certificate"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
    </div>
  );
}
