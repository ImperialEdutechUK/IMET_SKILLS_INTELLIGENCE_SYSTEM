import type { LucideIcon } from "lucide-react";

// Plain icon tile — the app's original brand-tint look. The name/API and the
// TONES export are kept stable so every caller stays unchanged; `tone` is now
// ignored (icons are uniform) but still accepted for compatibility.
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
  size = "md",
  live = false,
}: {
  icon: LucideIcon;
  tone?: Icon3DTone;
  size?: "sm" | "md" | "lg";
  live?: boolean;   // gentle float — for hero/header badges that should feel alive
}) {
  const dim = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const icn = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const radius = size === "lg" ? "rounded-2xl" : "rounded-xl";
  return (
    <span className={`grid ${dim} shrink-0 place-items-center ${radius} bg-[var(--brand-tint)] text-[var(--brand-dark)] ${live ? "gam-float" : ""}`}>
      <Icon className={icn} strokeWidth={2} />
    </span>
  );
}
