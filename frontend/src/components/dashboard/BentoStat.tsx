import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// A colourful Bento stat tile — solid-gradient or tinted rounded tiles in green
// and blue shades. The shared building block for the bento dashboards.
export type BentoTone = "greenSolid" | "blueSolid" | "green" | "blue" | "teal" | "amber" | "violet";

const TONES: Record<BentoTone, { bg: string; fg: string; solid?: boolean }> = {
  greenSolid: { bg: "linear-gradient(135deg,#2e7d5b,#1c5038)", fg: "#ffffff", solid: true },
  blueSolid:  { bg: "linear-gradient(135deg,#2563eb,#1e3a8a)", fg: "#ffffff", solid: true },
  green:      { bg: "#e8f1ed", fg: "#215c43" },
  blue:       { bg: "#e3eefb", fg: "#1d4ed8" },
  teal:       { bg: "#d7efe8", fg: "#0f766e" },
  amber:      { bg: "#fbefd6", fg: "#b45309" },
  violet:     { bg: "#ece9fb", fg: "#6d28d9" },
};

export default function BentoStat({
  icon: Icon, tone = "green", label, value, sub, href, className = "",
}: {
  icon: LucideIcon;
  tone?: BentoTone;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  className?: string;
}) {
  const t = TONES[tone];
  const inner = (
    <>
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${t.solid ? "bg-white/20" : "bg-white/70"}`}>
        <Icon className="h-5.5 w-5.5" style={{ width: 22, height: 22, color: t.fg }} />
      </span>
      <div className="mt-3">
        <p className="text-[2rem] font-extrabold leading-none" style={{ color: t.fg }}>{value}</p>
        <p className="mt-1.5 text-sm font-medium" style={{ color: t.fg, opacity: t.solid ? 0.9 : 0.85 }}>{label}</p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: t.fg, opacity: 0.7 }}>{sub}</p>}
      </div>
    </>
  );
  const cls = `flex h-full flex-col rounded-2xl p-5 ${className}`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md`} style={{ background: t.bg }}>{inner}</Link>
  ) : (
    <div className={cls} style={{ background: t.bg }}>{inner}</div>
  );
}
