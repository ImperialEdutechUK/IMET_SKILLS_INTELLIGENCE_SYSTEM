import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  iconBg?: string;
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  sub?: string;
  onClick?: () => void;
}

// Colourful Bento stat tile. Derives its tint from the legacy `iconBg` hint so
// existing call sites (amber = warning, red = risk, etc.) stay meaningful while
// adopting the bento look.
function toneFor(iconBg?: string): { bg: string; fg: string } {
  const s = iconBg ?? "";
  if (s.includes("amber") || s.includes("yellow") || s.includes("orange")) return { bg: "#fbefd6", fg: "#b45309" };
  if (s.includes("red") || s.includes("rose")) return { bg: "#fde8ea", fg: "#be123c" };
  if (s.includes("blue") || s.includes("sky") || s.includes("indigo")) return { bg: "#e3eefb", fg: "#1d4ed8" };
  if (s.includes("purple") || s.includes("violet")) return { bg: "#ece9fb", fg: "#6d28d9" };
  return { bg: "#e8f1ed", fg: "#215c43" }; // green default
}

export default function StatCard({ icon: Icon, iconBg, label, value, delta, deltaPositive = true, sub }: StatCardProps) {
  const c = toneFor(iconBg);
  return (
    <div className="flex h-full flex-col rounded-2xl p-5" style={{ background: c.bg }}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/70">
        <Icon className="h-5 w-5" style={{ color: c.fg }} />
      </span>
      <div className="mt-3">
        <p className="text-[2rem] font-extrabold leading-none" style={{ color: c.fg }}>{value}</p>
        <p className="mt-1.5 text-sm font-medium" style={{ color: c.fg, opacity: 0.85 }}>{label}</p>
        {delta && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium" style={{ color: deltaPositive ? c.fg : "#b45309" }}>
            <TrendingUp className="h-3 w-3" /> {delta}
          </p>
        )}
        {sub && <p className="mt-0.5 text-xs" style={{ color: c.fg, opacity: 0.7 }}>{sub}</p>}
      </div>
    </div>
  );
}
