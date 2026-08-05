"use client";

import { Check, X } from "lucide-react";
import { passwordRules } from "@/lib/password-rules";

/**
 * Live password-rule checklist.
 *
 * Only renders once the user has started typing — an all-red list under an
 * empty field reads as failure before they have done anything.
 */
export default function PasswordChecklist({ value }: { value: string }) {
  if (!value) return null;

  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2" aria-live="polite">
      {passwordRules(value).map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 text-xs ${
            rule.ok ? "text-[var(--brand-dark)]" : "text-[var(--muted)]"
          }`}
        >
          {rule.ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
          )}
          <span>{rule.label}</span>
          <span className="sr-only">{rule.ok ? " — met" : " — not met"}</span>
        </li>
      ))}
    </ul>
  );
}
