"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Trash2, X } from "lucide-react";
import { useApi, apiSend } from "@/lib/api";

interface Note {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Note[];
  unreadCount: number;
}

// The employee dashboard renders the same notifications as reminder banners, so
// clearing here has to make those disappear too.
const AFFECTED = ["/api/me/dashboard"];

export default function NotificationBell() {
  // SWR handles the poll (and pauses it when the tab is hidden), so the bell
  // paints from cache instantly on every navigation and refreshes in the
  // background.
  const { data, mutate } = useApi<NotificationsResponse>("/api/notifications", {
    refreshInterval: 60_000,
  });
  const notes = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;
  const [open, setOpen] = useState(false);
  // Clearing everything is destructive and un-undoable, so the bin icon asks
  // once rather than firing on the first click.
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // A closed panel must never reopen mid-confirm.
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  // Asking the question moves focus to the answer, so a keyboard user isn't
  // left pointing at a button that just changed meaning.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  // Escape backs out one level at a time: the confirm first, then the panel.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (confirming) {
      setConfirming(false);
    } else if (open) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Opening the panel counts as seen → mark all read. The badge clears
      // instantly and rolls back if the server rejects it.
      const seen: NotificationsResponse = {
        notifications: notes.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
      try {
        await mutate(
          async () => {
            await apiSend("/api/notifications", "POST");
            return seen;
          },
          { optimisticData: seen, rollbackOnError: true, revalidate: false },
        );
      } catch {
        /* ignore — badge is restored by the rollback */
      }
    }
  }

  // Remove one entry. Optimistic so the row leaves under the cursor; a failure
  // rolls it back rather than silently swallowing the click.
  async function remove(id: string) {
    const note = notes.find((n) => n.id === id);
    const after: NotificationsResponse = {
      notifications: notes.filter((n) => n.id !== id),
      unreadCount: note && !note.read ? Math.max(0, unread - 1) : unread,
    };
    try {
      await mutate(
        async () => {
          await apiSend("/api/notifications", "DELETE", { id }, { invalidates: AFFECTED });
          return after;
        },
        { optimisticData: after, rollbackOnError: true, revalidate: false },
      );
    } catch {
      /* ignore — the row is restored by the rollback */
    }
  }

  async function clearAll() {
    setClearing(true);
    const after: NotificationsResponse = { notifications: [], unreadCount: 0 };
    try {
      await mutate(
        async () => {
          await apiSend("/api/notifications", "DELETE", undefined, { invalidates: AFFECTED });
          return after;
        },
        { optimisticData: after, rollbackOnError: true, revalidate: false },
      );
      setConfirming(false);
    } catch {
      /* ignore — the list is restored by the rollback */
    }
    setClearing(false);
  }

  return (
    <div data-tour="topbar-notifications" className="relative" ref={ref} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ink)]">Notifications</p>
            {/* No entries → no control. A bin that can only ever do nothing is
                worse than an absent one. */}
            {notes.length > 0 && !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`Clear all ${notes.length} notifications`}
                title="Clear all"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {confirming && (
            <div className="border-b border-[var(--border)] bg-red-50/60 px-4 py-3">
              <p className="text-xs text-[var(--ink)]">
                Clear all {notes.length} notification{notes.length === 1 ? "" : "s"}? This can&apos;t be undone.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={clearAll}
                  disabled={clearing}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clearing ? "Clearing…" : "Clear all"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={clearing}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{n.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    {/* Always visible rather than hover-revealed: a hover-only
                        dismiss is unreachable on touch, where this panel is
                        used just as often. Muted until pointed at. */}
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      aria-label={`Remove notification: ${n.title}`}
                      title="Remove"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
