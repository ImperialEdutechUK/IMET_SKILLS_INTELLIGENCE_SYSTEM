"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">My Certificates</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Your earned certificates.</p>
      </div>
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : certificates.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">No certificates yet.</p></div>
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
        </div>
      )}
    </div>
  );
}
