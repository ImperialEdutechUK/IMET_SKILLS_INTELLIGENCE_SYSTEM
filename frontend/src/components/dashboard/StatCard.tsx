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
    <div className="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-white p-5">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${iconBg} text-[var(--brand-dark)]`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--muted)]">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-[var(--ink)]">{value}</p>
        {delta && (
          <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${deltaPositive ? "text-[var(--brand)]" : "text-amber-600"}`}>
            <TrendingUp className="h-3 w-3" />
            {delta}
          </p>
        )}
        {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
      </div>
    </div>
  );
}
