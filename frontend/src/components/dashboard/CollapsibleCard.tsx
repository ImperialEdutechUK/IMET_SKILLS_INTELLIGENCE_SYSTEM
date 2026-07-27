"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Icon3D, { type Icon3DTone, TONES } from "./Icon3D";

// A card whose body collapses behind its header — the "dropdown/menu" pattern
// the manager asked for, so the main dashboard stays clear and detail is opt-in.
export default function CollapsibleCard({
  title,
  subtitle,
  icon,
  tone = TONES.slate,
  defaultOpen = false,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Icon3DTone;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50"
      >
        {icon && <Icon3D icon={icon} tone={tone} size="sm" />}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[var(--ink)]">{title}</h3>
          {subtitle && <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>}
        </div>
        {right}
        <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-[var(--border)] p-5">{children}</div>}
    </div>
  );
}
