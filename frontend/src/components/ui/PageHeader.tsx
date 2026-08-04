import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// The one page header for every dashboard screen: a brand icon tile, a title,
// an optional subtitle and meta line, and an optional right-aligned action slot.
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  meta,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-[var(--ink)]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
          {meta && <div className="mt-1 text-sm text-[var(--muted)]">{meta}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
