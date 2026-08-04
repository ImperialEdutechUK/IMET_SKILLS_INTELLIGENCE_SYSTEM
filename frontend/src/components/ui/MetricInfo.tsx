"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

// Accessible definition affordance for a metric label. Keyboard-reachable
// button that toggles a popover (aria-expanded / aria-controls), closes on Esc
// or outside click. Deliberately NOT a `title=` attribute, which is
// mouse-only and invisible to keyboard/screen-reader users.
export default function MetricInfo({ label, definition }: { label: string; definition: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="grid h-4 w-4 place-items-center rounded-full text-[var(--muted)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-white p-3 text-left text-xs font-normal leading-relaxed text-[var(--ink)] shadow-[0_10px_30px_-12px_rgba(15,27,45,.35)]"
        >
          <span className="mb-1 block font-semibold">{label}</span>
          <span className="text-[var(--muted)]">{definition}</span>
        </span>
      )}
    </span>
  );
}
