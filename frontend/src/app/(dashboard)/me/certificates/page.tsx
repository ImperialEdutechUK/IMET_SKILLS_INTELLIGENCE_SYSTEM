"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ExternalLink, FileText, BookOpen } from "lucide-react";
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
  /** The uploaded PDF/image (data URL) — the certificate document itself. */
  fileUrl: string | null;
  /** The issuer's verification link. */
  certificateUrl: string | null;
  status: string;
}

// Read-only. Certificates are never created here: every one is earned by completing a
// course in My Learning, which is where the upload lives. That keeps a single path
// from evidence -> certificate -> CPD -> XP, with no way to mint a certificate that
// isn't attached to a course.
export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
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
            <p className="mt-1 text-sm text-[var(--muted)]">Every certificate you&apos;ve earned. You add them from My Learning — by completing a course, or adding one you finished elsewhere.</p>
          </div>
        </div>
        <Link href="/me/learning" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          <BookOpen className="h-4 w-4" /> Go to My Learning
        </Link>
      </div>

      {!loading && <AchievementsBento certificates={certificates.length} coursesCompleted={stats.coursesCompleted} cpdHours={stats.cpdHours} />}

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : certificates.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <div className="mx-auto w-fit"><Icon3D icon={Award} tone={TONES.violet} /></div>
          <p className="mt-3 text-sm font-medium text-[var(--ink)]">No certificates yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Complete a course in My Learning and upload its certificate — it lands here, with the CPD hours and XP that come with it.</p>
          <Link href="/me/learning" className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
            <BookOpen className="h-4 w-4" /> Go to My Learning
          </Link>
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
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xs text-[var(--muted)]">{cert.issuedDate}</span>
                {cert.cpdHours > 0 && <span className="text-xs font-medium text-[var(--brand-dark)]">+{cert.cpdHours} CPD</span>}
              </div>
              {/* Two distinct artefacts: the document the learner uploaded, and the
                  issuer's link to verify it. Older certificates may have neither. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {cert.fileUrl && (
                  <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> View Certificate
                  </a>
                )}
                {cert.certificateUrl && (
                  <a href={cert.certificateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                    <ExternalLink className="h-3.5 w-3.5" /> Verify
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

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

