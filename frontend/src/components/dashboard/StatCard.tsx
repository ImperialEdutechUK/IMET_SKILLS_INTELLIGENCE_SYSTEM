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

export default function StatCard({
  icon: Icon,
  iconBg = "bg-[var(--brand-tint)]",
  label,
  value,
  delta,
  deltaPositive = true,
  sub,
}: StatCardProps) {
  return (
    <div className="flex h-full gap-4 rounded-xl border border-[var(--border)] bg-white p-5">
      <span className={`grid h-12 w-12 shrink-0 self-start place-items-center rounded-xl ${iconBg} text-[var(--brand-dark)]`}>
        <Icon className="h-6 w-6" />
      </span>
      {/* Value block is pushed to the bottom (mt-auto) so numbers line up across
          the row no matter how many lines each label wraps to. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm text-[var(--muted)]">{label}</p>
        <div className="mt-auto pt-2">
          <p className="text-2xl font-bold leading-none text-[var(--ink)]">{value}</p>
          {delta && (
            <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${deltaPositive ? "text-[var(--brand)]" : "text-amber-600"}`}>
              <TrendingUp className="h-3 w-3" />
              {delta}
            </p>
          )}
          {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
