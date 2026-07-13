"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, AlertCircle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const missingConfig: Record<string, { label: string; bg: string; desc: string }> = {
  curriculum: { label: "Missing Curriculum", bg: "bg-amber-50 text-amber-700 border-amber-200", desc: "Add the main topics and modules so the AI can read deeply into this course." },
  learning_outcomes: { label: "No Learning Outcomes", bg: "bg-amber-50 text-amber-700 border-amber-200", desc: "Describe what learners will be able to do after completing this course." },
  category: { label: "Uncategorized", bg: "bg-red-50 text-red-700 border-red-200", desc: "Assign a category so the engine can match this course to skill gaps." },
  skill_tags: { label: "No Skill Tags", bg: "bg-orange-50 text-orange-700 border-orange-200", desc: "Tag the skills this course develops." },
};

interface Course { id: string; title: string; source: string; missing: string; }
interface Data { needsAttention: number; missingCurriculum: number; missingOutcomes: number; courses: Course[]; }

export default function ContentReviewPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/author/review`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load review queue.</p></div>;

  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">Content Review</h1></div><p className="mt-1 text-sm text-[var(--muted)]">Courses missing data the AI engine needs to recommend effectively.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={AlertCircle} iconBg="bg-amber-50" label="Needs Attention" value={data.needsAttention.toLocaleString()} sub="action required" />
        <StatCard icon={ClipboardCheck} label="Missing Curriculum" value={data.missingCurriculum.toLocaleString()} />
        <StatCard icon={ClipboardCheck} label="Missing Outcomes" value={data.missingOutcomes.toLocaleString()} />
      </div>
      {data.courses.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">All courses are complete.</p></div>
      ) : (
        <>
          <p className="mb-4 text-xs text-[var(--muted)]">Showing the {data.courses.length} most recent of {data.needsAttention.toLocaleString()} incomplete courses.</p>
          <div className="space-y-4">
            {data.courses.map((course) => {
              const cfg = missingConfig[course.missing] ?? missingConfig.curriculum;
              return (
                <div key={course.id} className="rounded-xl border border-[var(--border)] bg-white p-5">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--ink)]">{course.title}</h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">{course.source}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{cfg.desc}</p>
                    </div>
                    <a href="/author/courses/new" className="shrink-0 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">Complete</a>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
