"use client";

import { useEffect, useState } from "react";
import { Award, Upload } from "lucide-react";
import { getToken } from "@/lib/authClient";

interface Certificate {
  id: string;
  title: string;
  issuer: string;
  issuedDate: string;
  cpdHours: number;
  status: string;
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me/certificates`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCertificates(d.certificates); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">My Certificates</h1><p className="mt-1 text-sm text-[var(--muted)]">View and upload your earned certificates.</p></div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><Upload className="h-4 w-4" /> Upload</button>
      </div>
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="rounded-xl border border-[var(--border)] bg-white p-5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Award className="h-6 w-6" /></span>
              <h3 className="mt-4 font-semibold text-[var(--ink)]">{cert.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{cert.issuer}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">{cert.issuedDate}</span>
                <span className="rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-medium text-[var(--brand-dark)]">{cert.cpdHours} CPD hrs</span>
              </div>
            </div>
          ))}
          <button className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]">
            <Upload className="h-8 w-8" /><span className="text-sm font-medium">Upload New</span>
          </button>
        </div>
      )}
    </div>
  );
}
