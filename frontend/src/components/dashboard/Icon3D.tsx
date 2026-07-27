import type { LucideIcon } from "lucide-react";

// Flat, colour-coded icon tile: a soft tint of the tone with the icon in the
// tone's solid colour. Kept the name/API stable so every caller stays unchanged.
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
      className={`grid ${dim} shrink-0 place-items-center ${radius}`}
      style={{ background: `${tone.to}14`, color: tone.to }}
    >
      <Icon className={icn} strokeWidth={2} />
    </span>
  );
}
