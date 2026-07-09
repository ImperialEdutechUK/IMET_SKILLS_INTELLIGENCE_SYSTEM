"use client";
import { Tags, Plus } from "lucide-react";
import { CATEGORIES } from "@/lib/mock-data";
import { mySkills } from "@/lib/mock-data";

export default function TaxonomyPage() {
  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><Tags className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">Categories & Skills</h1></div><p className="mt-1 text-sm text-[var(--muted)]">Manage the taxonomy that drives course matching.</p></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-[var(--ink)]">Categories</h3><button className="flex items-center gap-1 text-sm font-medium text-[var(--brand)]"><Plus className="h-3.5 w-3.5" /> Add</button></div>
          <ul className="divide-y divide-[var(--border)]">
            {CATEGORIES.map((cat) => (
              <li key={cat} className="flex items-center justify-between py-3">
                <span className="text-sm text-[var(--ink)]">{cat}</span>
                <div className="flex gap-2">
                  <button className="text-xs text-[var(--brand)]">Edit</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-[var(--ink)]">Skills</h3><button className="flex items-center gap-1 text-sm font-medium text-[var(--brand)]"><Plus className="h-3.5 w-3.5" /> Add</button></div>
          <ul className="divide-y divide-[var(--border)]">
            {mySkills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between py-3">
                <span className="text-sm text-[var(--ink)]">{skill.name}</span>
                <span className="text-xs text-[var(--muted)]">{skill.category}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
