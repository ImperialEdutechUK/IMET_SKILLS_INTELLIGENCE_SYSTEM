import { CheckCircle2, AlertTriangle, AlertCircle, CircleDashed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// The one status pill. Colour is NEVER the only signal — every status carries an
// icon and a text label, so it is legible without colour perception.
export type Status = "on_track" | "attention" | "at_risk" | "not_started";

const CONFIG: Record<Status, { label: string; cls: string; icon: LucideIcon }> = {
  on_track: { label: "On track", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  attention: { label: "Behind pace", cls: "bg-amber-50 text-amber-700", icon: AlertTriangle },
  at_risk: { label: "At risk", cls: "bg-rose-50 text-rose-700", icon: AlertCircle },
  not_started: { label: "Not started", cls: "bg-slate-100 text-slate-600", icon: CircleDashed },
};

export default function StatusPill({ status, label }: { status: Status; label?: string }) {
  const c = CONFIG[status] ?? CONFIG.not_started;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label ?? c.label}
    </span>
  );
}
