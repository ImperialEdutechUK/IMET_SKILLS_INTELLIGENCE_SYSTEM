"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { clearAuth } from "@/lib/authClient";
import { GraduationCap, LogOut, ArrowLeft } from "lucide-react";
import { navConfig, departmentNav } from "@/lib/nav";
import Avatar from "@/components/ui/Avatar";
import type { SessionUser } from "@/types";

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const deptMatch = pathname.match(/^\/manager\/departments\/([^/]+)/);
  const inDepartment = user.role === "manager" && !!deptMatch;
  const departmentId = deptMatch?.[1] ?? null;
  const sections = inDepartment && departmentId ? departmentNav(departmentId) : navConfig[user.role];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-white">
          <GraduationCap className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
          <p className="text-[10px] text-[var(--muted)]">Skills Intelligence System</p>
        </div>
      </div>

      {inDepartment && (
        <Link href="/manager/dashboard" className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
          <ArrowLeft className="h-3.5 w-3.5" /> All Departments
        </Link>
      )}
      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-4" : ""}>
            {section.title && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]"
                          : "text-[var(--muted)] hover:bg-slate-50 hover:text-[var(--ink)]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar name={user.fullName} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--ink)]">{user.fullName}</p>
            <p className="truncate text-xs capitalize text-[var(--muted)]">{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => { clearAuth(); router.push("/login"); }}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
