"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

function SkillDots({ level, max = 5, filled = true }: { level: number; max?: number; filled?: boolean }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full border" style={{ background: i < level ? (filled ? "var(--brand)" : "#e6ebe8") : "transparent", borderColor: i < level ? (filled ? "var(--brand)" : "#e6ebe8") : "#e6ebe8" }} />
      ))}
    </div>
  );
}

interface Skill {
  id: string;
  name: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
}
interface SkillsData {
  total: number;
  onTarget: number;
  improving: number;
  skills: Skill[];
}

export default function MySkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me/skills`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  }
  if (!data) {
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load your skills.</p></div>;
  }

  const grouped = data.skills.reduce<Record<string, Skill[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">My Skills</h1><p className="mt-1 text-sm text-[var(--muted)]">Track your skill levels and growth targets.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Target} label="Total Skills" value={data.total} />
        <StatCard icon={Target} label="On Target" value={data.onTarget} delta="Keep going" deltaPositive />
        <StatCard icon={Target} label="Improving" value={data.improving} delta="Below target" deltaPositive />
      </div>
      {data.skills.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">No skills tracked yet.</p></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, skills]) => (
            <div key={category} className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">{category}</h3>
              <div className="space-y-4">
                {skills.map((skill) => (
                  <div key={skill.id} className="flex items-center gap-6">
                    <span className="w-40 text-sm text-[var(--ink)]">{skill.name}</span>
                    <div className="flex flex-1 items-center gap-6">
                      <div><p className="mb-1 text-[10px] text-[var(--muted)]">Current</p><SkillDots level={skill.currentLevel} /></div>
                      <div><p className="mb-1 text-[10px] text-[var(--muted)]">Target</p><SkillDots level={skill.targetLevel} filled={false} /></div>
                    </div>
                    <span className="text-xs text-[var(--muted)]">Lvl {skill.currentLevel}/{skill.targetLevel}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
