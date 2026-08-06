"use client";

/**
 * Confirm-and-delete dialog for permanently removing a user.
 *
 * Admin-only, and deliberately loud: it names the exact account, spells out
 * everything that will be erased, and states that the course catalogue and
 * other people's data are untouched. Focus starts on Cancel, never on the
 * destructive button, and the backdrop/Escape both close without deleting.
 */

import { useEffect, useRef, useState } from "react";
import { apiSend, ApiError } from "@/lib/api";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";

export interface DeleteTarget {
  id: string;
  fullName: string;
  email?: string;
  role: string;
}

export default function DeleteUserDialog({
  target,
  onClose,
}: {
  target: DeleteTarget;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await apiSend(`/api/admin/users/${target.id}`, "DELETE", undefined, {
        // Their rows feed every admin view; refetch the lot.
        invalidates: ["/api/admin"],
      });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete this user.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="delete-user-dialog-title" className="text-base font-bold text-[var(--ink)]">
              Delete this user permanently?
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {target.fullName}
              {target.email ? ` · ${target.email}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] transition-colors hover:bg-slate-50 hover:text-[var(--ink)] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong className="font-semibold">This cannot be undone.</strong> The account and
              every record belonging to{" "}
              <strong className="font-semibold">{target.fullName}</strong> will be erased from the
              database.
              {target.role !== "employee" && (
                <>
                  {" "}
                  This is a <strong className="font-semibold">{target.role}</strong> account.
                </>
              )}
            </p>
          </div>

          <p className="mt-4 text-sm font-medium text-[var(--ink)]">What will be deleted</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
            <Point>Course enrollments, progress and activity history.</Point>
            <Point>CPD records and certificates.</Point>
            <Point>Uploaded documents, including the files themselves.</Point>
            <Point>Skills, skill gaps and course recommendations.</Point>
            <Point>Notifications, evaluations and daily reports.</Point>
          </ul>

          <p className="mt-4 text-xs text-[var(--muted)]">
            The shared course catalogue and other people&apos;s data are not affected. Anyone this
            person managed keeps their account and is simply left without a manager.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              ref={cancelRef}
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
      <span>{children}</span>
    </li>
  );
}
