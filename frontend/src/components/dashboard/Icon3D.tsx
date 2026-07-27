import type { LucideIcon } from "lucide-react";

// A dimensional, glossy "3D-style" icon tile. Pure CSS (gradient + coloured
// shadow + top gloss highlight) — no external assets, so it deploys cleanly and
// needs no network. Colour the tile per-metric with `from`/`to` (hex).
export type Icon3DTone = { from: string; to: string };

export const TONES: Record<string, Icon3DTone> = {
  indigo:  { from: "#818cf8", to: "#4338ca" },
  blue:    { from: "#38bdf8", to: "#0369a1" },
  amber:   { from: "#fbbf24", to: "#b45309" },
  emerald: { from: "#34d399", to: "#047857" },
  rose:    { from: "#fb7185", to: "#be123c" },
  violet:  { from: "#a78bfa", to: "#6d28d9" },
  slate:   { from: "#94a3b8", to: "#475569" },
};

export default function Icon3D({
  icon: Icon,
  tone = TONES.emerald,
  size = "md",
}: {
  icon: LucideIcon;
  tone?: Icon3DTone;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const icn = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const radius = size === "lg" ? "rounded-2xl" : "rounded-xl";
  return (
    <span
      className={`relative grid ${dim} shrink-0 place-items-center ${radius} text-white`}
      style={{
        background: `linear-gradient(150deg, ${tone.from} 0%, ${tone.to} 100%)`,
        boxShadow: `0 8px 18px -6px ${tone.to}80, inset 0 1px 1px rgba(255,255,255,.45)`,
      }}
    >
      {/* top gloss highlight */}
      <span
        className={`pointer-events-none absolute inset-0 ${radius}`}
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 55%)" }}
      />
      <Icon className={`relative ${icn}`} strokeWidth={2.25} />
    </span>
  );
}
