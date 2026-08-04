import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import MetricInfo from "@/components/ui/MetricInfo";

// The one KPI tile for the whole app. A single bordered/white treatment — tint
// is reserved for semantic status, never chosen per page. Colour is derived
// from `status` only; a neutral metric renders neutral.
export type KpiStatus = "neutral" | "positive" | "warning" | "critical";

const STATUS: Record<KpiStatus, { chip: string; value: string }> = {
  neutral: { chip: "bg-[var(--brand-tint)] text-[var(--brand-dark)]", value: "text-[var(--ink)]" },
  positive: { chip: "bg-emerald-50 text-emerald-700", value: "text-[var(--ink)]" },
  warning: { chip: "bg-amber-50 text-amber-700", value: "text-[var(--ink)]" },
  critical: { chip: "bg-rose-50 text-rose-700", value: "text-rose-600" },
};

const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

export default function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  definition,
  status = "neutral",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  definition?: string;
  status?: KpiStatus;
  href?: string;
}) {
  const s = STATUS[status];
  const inner = (
    <>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${s.chip} transition-transform group-hover:scale-105`}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      {/* Numeral one step down from the old 2rem so four cards don't fill the viewport. */}
      <p className={`nums-tabular mt-4 text-[1.7rem] font-bold leading-none tracking-tight ${s.value}`}>{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--muted)]">
        {label}
        {definition && <span onClick={(e) => e.preventDefault()}><MetricInfo label={label} definition={definition} /></span>}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-[var(--muted)]/80">{sublabel}</p>}
    </>
  );
  const cls = `${CARD} group flex h-full flex-col p-5`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,27,45,.04),0_18px_38px_-18px_rgba(15,27,45,.22)]`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
