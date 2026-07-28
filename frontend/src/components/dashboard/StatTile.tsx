import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Reference-style stat tile (Etellar / gamified dashboards): a clean white card
// with a vivid gradient icon square, a big bold number and a quiet label. Light
// and professional, but colourful and alive (the icon bobs). Used by the manager
// and employee dashboards — deliberately separate from BentoStat so the admin /
// author dashboards keep their existing look.
export type TileTone = "green" | "sky" | "violet" | "pink" | "amber" | "teal";

const TONES: Record<TileTone, string> = {
  green:  "linear-gradient(135deg,#4ade80,#16a34a)",
  sky:    "linear-gradient(135deg,#38bdf8,#0284c7)",
  violet: "linear-gradient(135deg,#a78bfa,#7c3aed)",
  pink:   "linear-gradient(135deg,#f472b6,#db2777)",
  amber:  "linear-gradient(135deg,#fbbf24,#d97706)",
  teal:   "linear-gradient(135deg,#2dd4bf,#0d9488)",
};

export default function StatTile({
  icon: Icon, tone = "green", label, value, sub, delta, href, index = 0,
}: {
  icon: LucideIcon;
  tone?: TileTone;
  label: string;
  value: string | number;
  sub?: string;
  delta?: { dir: "up" | "down"; text: string };
  href?: string;
  index?: number;   // staggers the gentle icon bob so tiles don't move in lockstep
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className="gam-bob grid h-12 w-12 place-items-center rounded-2xl text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
          style={{ background: TONES[tone], animationDelay: `${(index % 4) * 0.4}s` }}
        >
          <Icon className="h-6 w-6" strokeWidth={2.2} />
        </span>
        {delta && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${delta.dir === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
            {delta.dir === "up" ? "▲" : "▼"} {delta.text}
          </span>
        )}
      </div>
      <p className="mt-4 text-[1.9rem] font-extrabold leading-none text-[var(--ink)]">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-[var(--muted)]">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]/80">{sub}</p>}
    </>
  );
  const cls = "group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
