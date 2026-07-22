"use client";

import { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import { getToken } from "@/lib/authClient";

interface Category { id: string; name: string; }
interface Skill { id: string; name: string; category: string; }
interface Data { categories: Category[]; skills: Skill[]; }

const SKILL_LIMIT = 100;

export default function TaxonomyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/author/taxonomy`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load taxonomy.</p></div>;

  const shownSkills = data.skills.slice(0, SKILL_LIMIT);

  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><Tags className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">Categories & Skills</h1></div><p className="mt-1 text-sm text-[var(--muted)]">The taxonomy that drives course matching.</p></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-[var(--ink)]">Categories <span className="text-xs font-normal text-[var(--muted)]">({data.categories.length})</span></h3></div>
          {data.categories.length === 0 ? <p className="text-sm text-[var(--muted)]">No categories yet.</p> : (
            <ul className="divide-y divide-[var(--border)]">
              {data.categories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-[var(--ink)]">{cat.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-[var(--ink)]">Skills <span className="text-xs font-normal text-[var(--muted)]">({data.skills.length.toLocaleString()})</span></h3></div>
          {data.skills.length === 0 ? <p className="text-sm text-[var(--muted)]">No skills yet.</p> : (
            <>
              <ul className="divide-y divide-[var(--border)]">
                {shownSkills.map((skill) => (
                  <li key={skill.id} className="flex items-center justify-between py-3">
                    <span className="text-sm text-[var(--ink)]">{skill.name}</span>
                    <span className="text-xs text-[var(--muted)]">{skill.category}</span>
                  </li>
                ))}
              </ul>
              {data.skills.length > SKILL_LIMIT && <p className="mt-3 text-xs text-[var(--muted)]">Showing first {SKILL_LIMIT} of {data.skills.length.toLocaleString()} skills.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
