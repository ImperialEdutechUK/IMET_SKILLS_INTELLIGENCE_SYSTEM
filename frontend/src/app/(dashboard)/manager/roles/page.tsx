"use client";

import { useEffect, useState } from "react";
import { Briefcase, Target, AlertTriangle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const importanceConfig: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

interface Requirement { id: string; skill: string; requiredLevel: number; importance: string; reason: string | null; }
interface Role { id: string; title: string; description: string | null; department: string | null; hasMatchingEmployees: boolean; requirements: Requirement[]; }
interface Data { totalRoles: number; positionsInUse: string[]; roles: Role[]; }

function LevelDots({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < level ? "var(--brand)" : "#e6ebe8" }} />
      ))}
    </div>
  );
}

export default function RoleProfilesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [openRole, setOpenRole] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/roles`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); if (d?.roles?.length) setOpenRole(d.roles[0].id); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load role profiles.</p></div>;

  const unmatchedPositions = data.positionsInUse.filter((p) => !data.roles.some((r) => r.title === p));

  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">Role Profiles</h1></div><p className="mt-1 text-sm text-[var(--muted)]">Skill requirements that define each role. These drive the gap analysis and course recommendations.</p></div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Briefcase} label="Defined Roles" value={data.totalRoles} />
        <StatCard icon={Target} label="Positions in Use" value={data.positionsInUse.length} sub="from employee records" />
        <StatCard icon={AlertTriangle} iconBg="bg-amber-50" label="Undefined Roles" value={unmatchedPositions.length} sub="no profile yet" />
      </div>

      {unmatchedPositions.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Positions without a role profile</p>
          <p className="mt-1 text-xs text-amber-700">These employee positions have no skill requirements defined, so no gaps can be computed for them: {unmatchedPositions.join(", ")}</p>
        </div>
      )}

      {data.roles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">No role profiles defined yet.</p></div>
      ) : (
        <div className="space-y-4">
          {data.roles.map((role) => {
            const isOpen = openRole === role.id;
            return (
              <div key={role.id} className="rounded-xl border border-[var(--border)] bg-white">
                <button onClick={() => setOpenRole(isOpen ? null : role.id)} className="flex w-full items-start justify-between gap-4 p-5 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[var(--ink)]">{role.title}</h3>
                      {role.department && <span className="rounded-full bg-[var(--brand-tint)] px-2.5 py-0.5 text-xs font-medium text-[var(--brand-dark)]">{role.department}</span>}
                      {role.hasMatchingEmployees && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Active</span>}
                    </div>
                    {role.description && <p className="mt-1 text-sm text-[var(--muted)]">{role.description}</p>}
                  </div>
                  <span className="shrink-0 text-sm text-[var(--muted)]">{role.requirements.length} skills</span>
                </button>
                {isOpen && role.requirements.length > 0 && (
                  <div className="border-t border-[var(--border)] p-5">
                    <ul className="space-y-3">
                      {role.requirements.map((req) => (
                        <li key={req.id} className="flex items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-[var(--ink)]">{req.skill}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${importanceConfig[req.importance] ?? importanceConfig.MEDIUM}`}>{req.importance}</span>
                            </div>
                            {req.reason && <p className="mt-0.5 text-xs text-[var(--muted)]">{req.reason}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="mb-1 text-[10px] text-[var(--muted)]">Required</p>
                            <LevelDots level={req.requiredLevel} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
