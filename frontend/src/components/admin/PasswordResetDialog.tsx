"use client";

/**
 * Issue a one-time password-reset code for a user.
 *
 * This is the administrator half of the account-recovery flow that replaced the
 * old unauthenticated reset endpoint. The shape of the dialog follows from the
 * shape of the secret:
 *
 *   - It is destructive-adjacent, so there is a confirm step naming the exact
 *     account. Two employees with similar names is precisely how a reset code
 *     reaches the wrong person.
 *   - The server returns the raw code ONCE and stores only its digest, so the
 *     code cannot be re-read afterwards. The UI has to say so before the admin
 *     closes the dialog, and must not hide it behind a hover or a toast.
 *   - It expires in an hour, so the expiry is shown as a time, not a duration
 *     the admin has to compute.
 *   - Issuing a second code voids the first, so re-issuing is safe but must be
 *     stated rather than assumed.
 */

import { useEffect, useRef, useState } from "react";
import { apiSend, ApiError } from "@/lib/api";
import {
  KeyRound,
  X,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface IssuedToken {
  userId: string;
  email: string;
  fullName: string;
  token: string;
  expiresAt: string;
}

export interface ResetTarget {
  id: string;
  fullName: string;
  email?: string;
  role: string;
}

export default function PasswordResetDialog({
  target,
  onClose,
}: {
  target: ResetTarget;
  onClose: () => void;
}) {
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus starts on a non-destructive control rather than on
  // the button that mints a credential.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const issue = async () => {
    setIssuing(true);
    setError("");
    try {
      const result = await apiSend<IssuedToken>("/api/admin/password-tokens", "POST", {
        userId: target.id,
      });
      setIssued(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not issue a reset code.");
    }
    setIssuing(false);
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure context, permissions). The
      // code is on screen and selectable, so this is not a dead end — say so
      // instead of failing silently.
      setError("Could not copy automatically — select the code and copy it manually.");
    }
  };

  const expiryLabel = issued
    ? new Date(issued.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      onClick={(e) => {
        // Only a click on the backdrop itself closes — never a stray click that
        // started inside the panel and drifted out.
        if (e.target === e.currentTarget && !issued) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="reset-dialog-title" className="text-base font-bold text-[var(--ink)]">
              {issued ? "Reset code issued" : "Issue a password reset code"}
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {target.fullName}
              {target.email ? ` · ${target.email}` : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] transition-colors hover:bg-slate-50 hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {!issued ? (
            <>
              <p className="text-sm text-[var(--ink)]">
                This creates a single-use code that lets{" "}
                <strong className="font-semibold">{target.fullName}</strong> set a new password.
                It does <strong className="font-semibold">not</strong> change their password by
                itself, and it does not sign them out.
              </p>

              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                <Point>Valid for one hour, and can only be used once.</Point>
                <Point>Shown to you once — it cannot be retrieved afterwards.</Point>
                <Point>Any code issued earlier for this account stops working.</Point>
              </ul>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Give the code to {target.fullName.split(" ")[0]} directly — in person or on a
                  call you initiated. Anyone holding it can set the password on this account.
                  {target.role !== "employee" && (
                    <>
                      {" "}
                      This is a <strong className="font-semibold">{target.role}</strong> account.
                    </>
                  )}
                </p>
              </div>

              {error && <ErrorLine message={error} />}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={issue}
                  disabled={issuing}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-60"
                >
                  {issuing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {issuing ? "Issuing…" : "Issue code"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <strong className="font-semibold">Copy this now.</strong> It is not stored and
                  will not be shown again. If you lose it, issue a new one.
                </p>
              </div>

              <label className="mt-4 block text-xs font-medium text-[var(--muted)]">
                Reset code
              </label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[var(--ink)]">
                  {issued.token}
                </code>
                <button
                  onClick={copy}
                  aria-label="Copy reset code"
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[var(--border)] px-3 py-2.5 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[var(--brand-dark)]" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] bg-slate-50/70 px-3.5 py-3">
                <p className="text-xs font-semibold text-[var(--ink)]">
                  What to tell {issued.fullName.split(" ")[0]}
                </p>
                <ol className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
                  <li>
                    1. Go to <span className="font-medium text-[var(--ink)]">/forgot-password</span>{" "}
                    on the sign-in page.
                  </li>
                  <li>2. Paste the code above.</li>
                  <li>3. Choose a new password.</li>
                </ol>
                <p className="mt-2.5 text-xs text-[var(--muted)]">
                  Expires at <span className="font-medium text-[var(--ink)]">{expiryLabel}</span>{" "}
                  today · for {issued.email}
                </p>
              </div>

              {error && <ErrorLine message={error} />}

              <div className="mt-5 flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)]"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
      <span>{children}</span>
    </li>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}
