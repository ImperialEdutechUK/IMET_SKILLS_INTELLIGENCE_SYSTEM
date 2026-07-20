"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpen, TrendingUp, Megaphone, Headphones,
  Cpu, Wallet, Settings, GraduationCap, Users,
} from "lucide-react";
import { getToken } from "@/lib/authClient";

const DEPARTMENT_STYLES: Record<string, { icon: typeof Users; bg: string; fg: string }> = {
  "CDD": { icon: BookOpen, bg: "#eef4fc", fg: "#3b6ea5" },
  "Sales": { icon: TrendingUp, bg: "#fdf3e7", fg: "#b8792f" },
  "Marketing": { icon: Megaphone, bg: "#fdeef0", fg: "#c2536b" },
  "Customer Service": { icon: Headphones, bg: "#f2eefc", fg: "#7654b0" },
  "IT": { icon: Cpu, bg: "#e9f7f6", fg: "#2f8f86" },
  "Finance": { icon: Wallet, bg: "#eef9ef", fg: "#3f8a52" },
  "Operations": { icon: Settings, bg: "#f5f1ea", fg: "#8a6d3f" },
  "Academic": { icon: GraduationCap, bg: "#eef0fb", fg: "#4a5fc1" },
};
const DEFAULT_STYLE = { icon: Users, bg: "#f4f8f6", fg: "var(--brand-dark)" };

interface DeptSummary {
  id: string;
  name: string;
  teamMembers: number;
  avgCpd: number;
  avgSkillLevel: number;
}

export default function ManagerDashboardPage() {
  const [fullName, setFullName] = useState("");
  const [departments, setDepartments] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/dashboard`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setFullName(d.fullName);
          setDepartments(d.departments);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {fullName.split(" ")[0]}!</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Select a department to see its team, learning progress, and CPD status.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const style = DEPARTMENT_STYLES[dept.name] ?? DEFAULT_STYLE;
          const Icon = style.icon;
          return (
            <Link
              key={dept.id}
              href={`/manager/departments/${dept.id}`}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--muted)]/40 hover:shadow-sm"
            >
              <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: style.fg }} />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ color: style.fg, backgroundColor: style.bg }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-[var(--ink)]">{dept.name}</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-2xl font-bold leading-none text-[var(--ink)]">{dept.teamMembers}</p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Employees</p>
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-[var(--ink)]">{dept.avgCpd}<span className="text-base font-semibold text-[var(--muted)]">%</span></p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Avg CPD</p>
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-[var(--ink)]">{dept.avgSkillLevel}<span className="text-base font-semibold text-[var(--muted)]">/5</span></p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Avg Skill</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
