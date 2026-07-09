"use client";
import { useState } from "react";
import { BookOpen, Upload } from "lucide-react";
import { CATEGORIES } from "@/lib/mock-data";

export default function AddCoursePage() {
  const [source, setSource] = useState("internal");
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Add / Import Course</h1><p className="mt-1 text-sm text-[var(--muted)]">Add a course to the recommendation engine&apos;s working set.</p></div>
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Course Details</h3></div>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Source</label>
              <select value={source} onChange={e => setSource(e.target.value)} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                {["coursera","edx","linkedin","internal"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            {source !== "internal" && <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">External URL</label><input placeholder="https://coursera.org/..." className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>}
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Title</label><input placeholder="Course title" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Description</label><textarea rows={3} placeholder="Course description" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Curriculum</label><textarea rows={4} placeholder="List the main topics and modules..." className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Learning Outcomes</label><textarea rows={3} placeholder="What will learners be able to do?" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Category</label>
                <select className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Level</label>
                <select className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                  {["Beginner","Intermediate","Advanced"].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Duration (hours)</label><input type="number" placeholder="8" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
              <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">CPD Hours</label><input type="number" placeholder="8" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            </div>
            <div className="flex gap-3">
              <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">Save Draft</button>
              <button className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">Publish Course</button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><Upload className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Bulk Import (CSV)</h3></div>
          <p className="mb-3 text-sm text-[var(--muted)]">Upload a CSV with columns: title, description, curriculum, learning_outcomes, source, external_url, category, level, duration_hours, cpd_hours</p>
          <button className="flex items-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] px-6 py-4 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"><Upload className="h-4 w-4" /> Click to upload CSV</button>
        </div>
      </div>
    </div>
  );
}
