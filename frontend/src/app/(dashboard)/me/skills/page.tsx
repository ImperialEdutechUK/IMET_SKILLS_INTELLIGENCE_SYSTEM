"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Star, Target, PlusCircle, CheckCircle2, ArrowUpRight, Plus, X, PieChart, Pencil } from "lucide-react";
import Stat3D from "@/components/dashboard/Stat3D";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Skill { id: string; name: string; category: string; currentLevel: number; targetLevel: number; currentLabel: string; targetLabel: string }
interface Improve { id: string; name: string; category: string; current: number; target: number; currentLabel: string; targetLabel: string; gap: number; priority: string }
interface SkillsData {
  overview: { total: number; strengths: number; toImprove: number; newSkills: number };
  skills: Skill[];
  distribution: { name: string; value: number; color: string }[];
  topStrengths: string[];
  recentlyAdded: { name: string; date: string }[];
  toImprove: Improve[];
}

type Tab = "overview" | "improve";
const levelBadge: Record<string, string> = {
  Advanced: "bg-[var(--brand-tint)] text-[var(--brand-dark)]", Expert: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  Intermediate: "bg-blue-50 text-blue-700", Beginner: "bg-amber-50 text-amber-700", "Not Started": "bg-slate-100 text-slate-600",
};
const prioBadge: Record<string, string> = { High: "bg-red-50 text-red-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-[var(--brand-tint)] text-[var(--brand-dark)]" };

const LEVELS = ["Not Started", "Beginner", "Intermediate", "Advanced", "Expert"];
const PER_PAGE = 6;

type Dialog = { mode: "add" } | { mode: "edit"; id: string; name: string };

interface SaveResponse {
  achieved?: boolean;
  skill?: { name: string; currentLabel: string; targetLabel: string };
  refreshed?: { gapsRecomputed: boolean; outstandingGaps: number; recommendationsCleared: number } | null;
}

/**
 * Say what the edit actually did downstream. A level change isn't just a label:
 * it re-runs the gap analysis and drops course picks the employee has outgrown,
 * so the confirmation reports that rather than a bare "Saved". `refreshed` is
 * null when the backend couldn't recompute — we don't claim it happened.
 */
function editNotice(d: SaveResponse): string {
  const skillName = d.skill?.name ?? "Skill";
  // When the target is reached the row disappears from the list the employee is
  // looking at — say why, so it reads as completion rather than as a glitch.
  const head = d.achieved
    ? `${skillName} is now at ${d.skill?.currentLabel} — target reached, so it's moved out of Skills to Improve.`
    : `${skillName} updated to ${d.skill?.currentLabel} (target ${d.skill?.targetLabel}).`;
  if (!d.refreshed) return `${head} Your recommendations will pick this up on their next run.`;
  const cleared = d.refreshed.recommendationsCleared;
  const tail = cleared > 0
    ? ` Gaps recalculated, and ${cleared} course pick${cleared === 1 ? "" : "s"} you've outgrown ${cleared === 1 ? "was" : "were"} removed.`
    : " Gaps recalculated — your next recommendations use the new level.";
  return head + tail;
}

export default function MySkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [skillsPage, setSkillsPage] = useState(1);
  const [improvePage, setImprovePage] = useState(1);

  // Add / edit form state. One dialog serves both: adding a skill and revising
  // the level on one you already have (the "I've reached my target" flow).
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState(1);
  const [target, setTarget] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/me/skills`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setName(""); setCurrent(1); setTarget(3); setNotes(""); setAddErr("");
    setDialog({ mode: "add" });
  };
  const openEdit = (s: { id: string; name: string; currentLevel: number; targetLevel: number }) => {
    setName(s.name); setCurrent(s.currentLevel); setTarget(s.targetLevel); setNotes(""); setAddErr("");
    setDialog({ mode: "edit", id: s.id, name: s.name });
  };

  const save = async () => {
    if (!dialog) return;
    if (dialog.mode === "add" && !name.trim()) { setAddErr("Enter a skill name."); return; }
    setSaving(true); setAddErr("");
    try {
      const r = dialog.mode === "add"
        ? await fetch(`${API}/api/me/skills`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), currentLevel: current, targetLevel: target, gapAnalysis: notes.trim() }),
          })
        : await fetch(`${API}/api/me/skills/${dialog.id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ currentLevel: current, targetLevel: target }),
          });
      const d = await r.json();
      if (!r.ok) { setAddErr(d.error ?? (dialog.mode === "add" ? "Could not add skill." : "Could not save your changes.")); setSaving(false); return; }
      setDialog(null);
      setNotice(dialog.mode === "edit" ? editNotice(d) : "");
      await load();
    } catch {
      setAddErr(dialog.mode === "add" ? "Could not add skill." : "Could not save your changes.");
    }
    setSaving(false);
  };

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load your skills.</p></div>;

  // Client-side pagination — clamped so a shrinking list can never leave us on an empty page.
  const skillsTotalPages = Math.max(1, Math.ceil(data.skills.length / PER_PAGE));
  const skillsCurrent = Math.min(skillsPage, skillsTotalPages);
  const visibleSkills = data.skills.slice((skillsCurrent - 1) * PER_PAGE, skillsCurrent * PER_PAGE);

  const improveTotalPages = Math.max(1, Math.ceil(data.toImprove.length / PER_PAGE));
  const improveCurrent = Math.min(improvePage, improveTotalPages);
  const visibleImprove = data.toImprove.slice((improveCurrent - 1) * PER_PAGE, improveCurrent * PER_PAGE);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon3D icon={Target} tone={TONES.emerald} />
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">My Skills</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Track your skills, see your progress and plan what to improve next.</p>
          </div>
        </div>
        <button data-tour="skills-add" onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          <Plus className="h-4 w-4" /> Add Skill
        </button>
      </div>

      {notice && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-tint)] p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-dark)]" />
          <p className="flex-1 text-sm text-[var(--brand-dark)]">{notice}</p>
          <button onClick={() => setNotice("")} className="text-[var(--brand-dark)]/60 hover:text-[var(--brand-dark)]"><X className="h-4 w-4" /></button>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setDialog(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/85 p-6 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--ink)]">{dialog.mode === "add" ? "Add a Skill" : `Update ${dialog.name}`}</h3>
              <button onClick={() => setDialog(null)} className="text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {dialog.mode === "add" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Skill name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prompt Engineering"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" autoFocus />
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Moved up a level? Record it here. Your skill gaps are recalculated straight away, so the next
                  recommendations you get are based on where you are now.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Current level</label>
                  <select value={current} onChange={(e) => setCurrent(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                    {LEVELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Target level</label>
                  {/* "Not Started" is not a goal — the backend rejects a target below Beginner. */}
                  <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                    {LEVELS.map((l, i) => (i === 0 ? null : <option key={l} value={i}>{l}</option>))}
                  </select>
                </div>
              </div>
              {dialog.mode === "edit" && current >= target && (
                <p className="rounded-lg bg-[var(--brand-tint)] px-3 py-2 text-xs text-[var(--brand-dark)]">
                  Target reached — this skill drops out of Skills to Improve and stops driving recommendations.
                  Raise the target to keep going.
                </p>
              )}
              {dialog.mode === "add" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Gap Analysis <span className="font-normal text-[var(--muted)]">(optional)</span></label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Need hands-on fine-tuning project."
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" />
                </div>
              )}
              {addErr && <p className="text-sm text-red-600">{addErr}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setDialog(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">Cancel</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
                  {saving ? "Saving…" : dialog.mode === "add" ? "Add Skill" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div data-tour="skills-tabs" className="mb-6 flex flex-wrap gap-6 border-b border-[var(--border)]">
        {([["overview", "Overview"], ["improve", "Skills to Improve"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${tab === k ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat3D icon={TrendingUp} tone={TONES.blue} label="Overall Skills" value={data.overview.total} sub="Skills added" />
            <Stat3D icon={Star} tone={TONES.emerald} label="Strengths" value={data.overview.strengths} sub="Strong skills" />
            <Stat3D icon={Target} tone={TONES.amber} label="Skills to Improve" value={data.overview.toImprove} sub="Needs attention" />
            <Stat3D icon={PlusCircle} tone={TONES.violet} label="New Skills" value={data.overview.newSkills} sub="Recently added" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-white">
              <div className="flex items-center gap-3 border-b border-[var(--border)] p-5"><Icon3D icon={TrendingUp} tone={TONES.emerald} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Your Skills</h3></div>
              {data.skills.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">No skills recorded yet.</p> : (
                <ul className="divide-y divide-[var(--border)]">
                  {visibleSkills.map((s) => (
                    <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--ink)]">{s.name}</p><p className="text-xs text-[var(--muted)]">{s.category}</p></div>
                      <div className="hidden w-40 sm:block"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(s.currentLevel / 4) * 100}%` }} /></div></div>
                      {/* Read-only: levels are revised in Skills to Improve, where the
                          gap being closed is in view. Overview is the at-a-glance list. */}
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${levelBadge[s.currentLabel] ?? "bg-slate-100 text-slate-600"}`}>{s.currentLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Pager page={skillsCurrent} totalPages={skillsTotalPages} total={data.skills.length} onChange={setSkillsPage} />
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="mb-4 flex items-center gap-3"><Icon3D icon={PieChart} tone={TONES.violet} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Skill Distribution</h3></div>
                {data.distribution.length === 0 ? <p className="text-sm text-[var(--muted)]">No data.</p> :
                  <LearnDonutChart data={data.distribution} label={`${data.overview.total}`} sublabel="Total" height={160} />}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="mb-3 flex items-center gap-3"><Icon3D icon={Star} tone={TONES.emerald} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Top Strengths</h3></div>
                {data.topStrengths.length === 0 ? <p className="text-sm text-[var(--muted)]">Build a skill to Advanced to see it here.</p> : (
                  <ul className="space-y-2">{data.topStrengths.map((s) => <li key={s} className="flex items-center gap-2 text-sm text-[var(--ink)]"><CheckCircle2 className="h-4 w-4 text-[var(--brand)]" /> {s}</li>)}</ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "improve" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-white">
            <div className="flex items-center gap-3 border-b border-[var(--border)] p-5"><Icon3D icon={Target} tone={TONES.amber} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Skills to Improve</h3></div>
            {data.toImprove.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">You&apos;re on target across your skills. Nice work!</p> : (
              <ul className="divide-y divide-[var(--border)]">
                {visibleImprove.map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--ink)]">{s.name}</p><p className="text-xs text-[var(--muted)]">{s.category}</p></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${prioBadge[s.priority] ?? "bg-slate-100 text-slate-600"}`}>{s.priority}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                      <span>Current: <b className="text-[var(--ink)]">{s.currentLabel}</b></span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Target: <b className="text-[var(--brand)]">{s.targetLabel}</b></span>
                      {/* Closing the gap happens here: record the new level and the engine re-scores. */}
                      <button onClick={() => openEdit({ id: s.id, name: s.name, currentLevel: s.current, targetLevel: s.target })}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 font-medium text-[var(--ink)] hover:bg-slate-50">
                        <Pencil className="h-3 w-3" /> Update level
                      </button>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(s.current / s.target) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={improveCurrent} totalPages={improveTotalPages} total={data.toImprove.length} onChange={setImprovePage} />
          </div>
          <div className="space-y-6">
            <InfoCard title="Why Improve These Skills?" items={[
              ["Role Relevance", "These skills matter most for your current role."],
              ["Career Growth", "Boost your profile and open new opportunities."],
              ["Personal Growth", "Build confidence and solve real-world problems."],
            ]} />
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-3 font-semibold text-[var(--ink)]">Recommended Next Steps</h3>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li>• Start a course to build these skills</li>
                <li>• Follow a structured learning path</li>
                <li>• Practice on real projects and quizzes</li>
              </ul>
              <Link href="/me/recommendations" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)]">See recommendations <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Pager({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  return (
    <div className="flex items-center justify-between border-t border-[var(--border)] p-4">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40">Previous</button>
      <span className="text-sm text-[var(--muted)]">{from}–{to} of {total}</span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40">Next</button>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 font-semibold text-[var(--ink)]">{title}</h3>
      <ul className="space-y-3">
        {items.map(([h, b]) => (
          <li key={h} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
            <div><p className="text-sm font-medium text-[var(--ink)]">{h}</p><p className="text-xs text-[var(--muted)]">{b}</p></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
