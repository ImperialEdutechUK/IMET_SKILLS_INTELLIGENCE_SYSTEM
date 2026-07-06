import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  TrendingUp,
  Megaphone,
  Headphones,
  Cpu,
  Wallet,
  Settings,
  GraduationCap,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllDepartmentSummaries } from "@/lib/team-queries";

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

export default async function ManagerDashboardPage() {
  const session = await auth();
  const manager = await prisma.user.findUnique({ where: { id: session!.user.id! } });
  const departments = await getAllDepartmentSummaries();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {manager?.fullName.split(" ")[0]}! 👋</h1>
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
              className="group rounded-xl border border-[var(--border)] p-5 transition-shadow hover:shadow-md"
              style={{ backgroundColor: style.bg }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/70"
                    style={{ color: style.fg }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-[var(--ink)]">{dept.name}</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[var(--ink)]">{dept.teamMembers}</p>
                  <p className="text-[10px] text-[var(--muted)]">Employees</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--brand)]">{dept.avgCpd}%</p>
                  <p className="text-[10px] text-[var(--muted)]">Avg CPD</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--ink)]">{dept.avgSkillLevel}/5</p>
                  <p className="text-[10px] text-[var(--muted)]">Avg Skill</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
