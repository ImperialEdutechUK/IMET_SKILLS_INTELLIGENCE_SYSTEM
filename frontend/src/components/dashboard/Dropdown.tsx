"use client";

import { ChevronDown } from "lucide-react";

// Compact, professional dropdown menu — a styled native <select> (reliable and
// accessible) with a chevron affordance. Shared across the manager dashboard.
export default function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-[var(--border)] bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
    </div>
  );
}
