// The one progress/level bar. Always renders its numeric value and is an
// accessible progressbar (role + aria-valuenow/min/max + label). `tone` picks
// the fill colour semantically; it never means "more is better" on one panel
// and "worse" on another — callers label the axis.
export type BarTone = "brand" | "positive" | "warning" | "critical";

const FILL: Record<BarTone, string> = {
  brand: "bg-[var(--brand)]",
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};

export default function ProgressBar({
  value,
  max = 100,
  label,
  tone = "brand",
  showValue = true,
  valueSuffix = "%",
  hideLabel = false,
}: {
  value: number;
  max?: number;
  /** Accessible label describing what the bar measures. Always on the a11y tree. */
  label: string;
  tone?: BarTone;
  showValue?: boolean;
  valueSuffix?: string;
  /** Hide the visible label (e.g. inside a table where the row already names it). */
  hideLabel?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      {(!hideLabel || showValue) && (
        <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
          {!hideLabel ? <span className="min-w-0 truncate font-medium text-[var(--ink)]">{label}</span> : <span />}
          {showValue && <span className="nums-tabular shrink-0 text-[var(--muted)]">{value}{valueSuffix}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
