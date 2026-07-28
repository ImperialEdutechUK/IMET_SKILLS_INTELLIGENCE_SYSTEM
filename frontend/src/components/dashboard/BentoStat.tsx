import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// A colourful Bento stat tile — solid-gradient or tinted rounded tiles in green
// and blue shades. The shared building block for the bento dashboards.
export type BentoTone = "greenSolid" | "blueSolid" | "green" | "blue" | "teal" | "amber" | "violet";

// Softer, lighter palette — professional and easy on the eye, still colourful and
// gamified. The two "solid" tones are gentle gradients (not dark blocks) with a
// tinted-ink label so nothing shouts; the rest are pastel tints.
const TONES: Record<BentoTone, { bg: string; fg: string; solid?: boolean }> = {
  greenSolid: { bg: "linear-gradient(135deg,#5cb891,#3f9d75)", fg: "#ffffff", solid: true },
  blueSolid:  { bg: "linear-gradient(135deg,#6f9ef4,#4f7fe6)", fg: "#ffffff", solid: true },
  green:      { bg: "#eaf4ee", fg: "#2b6b4e" },
  blue:       { bg: "#e8f0fd", fg: "#2456c8" },
  teal:       { bg: "#e0f2ec", fg: "#14806f" },
  amber:      { bg: "#fbf1de", fg: "#b06a12" },
  violet:     { bg: "#f0edfc", fg: "#6d3fd6" },
};

export default function BentoStat({
  icon: Icon, tone = "green", label, value, sub, href, className = "", index = 0,
}: {
  icon: LucideIcon;
  tone?: BentoTone;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  className?: string;
  index?: number;   // staggers the gentle icon bob so tiles don't move in lockstep
}) {
  const t = TONES[tone];
  const inner = (
    <>
      <span className={`gam-bob grid h-11 w-11 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${t.solid ? "bg-white/20" : "bg-white/70"}`} style={{ animationDelay: `${(index % 4) * 0.4}s` }}>
        <Icon className="h-5.5 w-5.5" style={{ width: 22, height: 22, color: t.fg }} />
      </span>
      <div className="mt-3">
        <p className="text-[2rem] font-extrabold leading-none" style={{ color: t.fg }}>{value}</p>
        <p className="mt-1.5 text-sm font-medium" style={{ color: t.fg, opacity: t.solid ? 0.9 : 0.85 }}>{label}</p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: t.fg, opacity: 0.7 }}>{sub}</p>}
      </div>
    </>
  );
  const cls = `group flex h-full flex-col rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-md ${className}`;
  return href ? (
    <Link href={href} className={cls} style={{ background: t.bg }}>{inner}</Link>
  ) : (
    <div className={cls} style={{ background: t.bg }}>{inner}</div>
  );
}
