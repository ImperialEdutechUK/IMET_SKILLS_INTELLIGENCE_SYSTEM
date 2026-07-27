import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface AttentionItem {
  id: string;
  fullName: string;
  reason: string;
  status: "at_risk" | "inactive" | "attention";
  avatarUrl?: string | null;
}

const statusConfig = {
  at_risk: { label: "At Risk", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  inactive: { label: "Inactive", bg: "bg-slate-100 text-slate-600 border-slate-200" },
  attention: { label: "Attention", bg: "bg-orange-50 text-orange-700 border-orange-200" },
};

function Initials({ name }: { name: string }) {
  const parts = name.split(" ").filter(Boolean);
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">
      {parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
    </span>
  );
}

export default function AttentionList({
  items,
  title = "Employees Needing Attention",
  viewAllHref,
}: {
  items: AttentionItem[];
  title?: string;
  viewAllHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--ink)]">{title}</h3>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
            View All
          </Link>
        )}
      </div>
      <ul className="space-y-1">
        {items.map((item) => {
          const cfg = statusConfig[item.status];
          return (
            <li key={item.id}>
              <Link href={`/manager/employees/${item.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                <Initials name={item.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">{item.fullName}</p>
                  <p className="text-xs text-[var(--muted)]">{item.reason}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg}`}>
                  {cfg.label}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
