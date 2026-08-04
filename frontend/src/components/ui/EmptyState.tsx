import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// The one empty state. When a page has NO data, render this instead of a row of
// zero-value KPI cards plus scattered "no data" messages. Copy rule: state what
// will appear and give the action — no apologies, no exclamation marks.
export default function EmptyState({
  icon: Icon,
  heading,
  message,
  action,
}: {
  icon?: LucideIcon;
  heading: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
      )}
      <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">{heading}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
