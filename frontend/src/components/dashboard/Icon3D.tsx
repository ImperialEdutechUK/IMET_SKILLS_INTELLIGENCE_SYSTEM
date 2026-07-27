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
        boxShadow: `0 10px 20px -6px ${tone.to}66, 0 2px 4px -1px ${tone.to}4d, inset 0 1.5px 1px rgba(255,255,255,.55), inset 0 -3px 6px ${tone.to}55`,
      }}
    >
      {/* top-left glossy highlight for a rounded, lit-from-above 3D look */}
      <span
        className={`pointer-events-none absolute inset-0 ${radius}`}
        style={{ background: "radial-gradient(120% 90% at 28% 8%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 45%)" }}
      />
      <Icon className={`relative ${icn} drop-shadow-[0_1px_1px_rgba(0,0,0,.18)]`} strokeWidth={2.25} />
    </span>
  );
}
