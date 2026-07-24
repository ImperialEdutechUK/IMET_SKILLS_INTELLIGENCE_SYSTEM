"use client";

import { useEffect, useState } from "react";
import { Award, Plus, ExternalLink, X } from "lucide-react";
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

  const load = () => {
    fetch(`${API}/api/me/certificates`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCertificates(d.certificates); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">My Certificates</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Your earned certificates. Add certificates from courses you completed elsewhere and attach the link.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          <Plus className="h-4 w-4" /> Add Certificate
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : certificates.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Award className="h-6 w-6" /></span>
          <p className="mt-3 text-sm font-medium text-[var(--ink)]">No certificates yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Completing a course earns one automatically, or add one manually with its link.</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add Certificate
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-5">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Award className="h-6 w-6" /></span>
                <StatusBadge status={cert.status} />
              </div>
              <h3 className="mt-4 font-semibold text-[var(--ink)]">{cert.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{cert.issuer}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">{cert.issuedDate}</span>
                <span className="rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-medium text-[var(--brand-dark)]">{cert.cpdHours} CPD hrs</span>
              </div>
              {cert.fileUrl && (
                <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                  <ExternalLink className="h-3.5 w-3.5" /> View Certificate
                </a>
              )}
            </div>
          ))}
        </div>
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
  const [cpdHours, setCpdHours] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [addCpd, setAddCpd] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim()) { setError("Course name is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/api/me/certificates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          issuer: issuer.trim() || undefined,
          fileUrl: fileUrl.trim() || undefined,
          cpdHours: cpdHours ? Number(cpdHours) : undefined,
          issuedDate: issuedDate || undefined,
          addCpd,
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
          <Field label="Certificate link (URL)">
            <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPD hours">
              <input value={cpdHours} onChange={(e) => setCpdHours(e.target.value)} type="number" min={0} step={0.5} placeholder="e.g. 8"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
            </Field>
            <Field label="Date completed">
              <input value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} type="date"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={addCpd} onChange={(e) => setAddCpd(e.target.checked)} className="accent-[var(--brand)]" />
            Count these hours towards my CPD
          </label>
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
