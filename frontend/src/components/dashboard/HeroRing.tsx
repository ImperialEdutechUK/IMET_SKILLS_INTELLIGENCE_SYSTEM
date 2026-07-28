import ProgressRing from "@/components/cpd/ProgressRing";

// Reference-style hero (the "Level 7" card): a large circular progress ring on the
// left with a headline inside it, a title + subtitle, up to three big metric
// columns, and an optional action slot on the right. Light card, gamified feel.
// Reused by the manager and employee dashboards so both lead with one clear ring.
export default function HeroRing({
  percent, ringColor = "var(--brand)", ringLabel, ringSublabel,
  title, subtitle, metrics = [], accent = "#eef7f2", children,
}: {
  percent: number;
  ringColor?: string;
  ringLabel: string;
  ringSublabel?: string;
  title: string;
  subtitle?: string;
  metrics?: { label: string; value: string; color?: string }[];
  accent?: string;   // soft tint wash behind the card
  children?: React.ReactNode;   // action slot (button / link)
}) {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-3xl border border-[var(--border)] p-6 sm:p-7"
      style={{ background: `linear-gradient(135deg, ${accent}, #ffffff 65%)` }}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: ringColor }} />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0 gam-float">
          <ProgressRing percentage={percent} size={150} strokeWidth={12} color={ringColor}
            trackColor="rgba(15,27,45,.08)" label={ringLabel} sublabel={ringSublabel} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-2xl font-extrabold text-[var(--ink)]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
          {metrics.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3 sm:justify-start">
              {metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-xs font-medium text-[var(--muted)]">{m.label}</p>
                  <p className="text-xl font-extrabold" style={{ color: m.color ?? "var(--ink)" }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
          {children && <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">{children}</div>}
        </div>
      </div>
    </div>
  );
}
