"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
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
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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

  return (
    <div data-tour="topbar-notifications" className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
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
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ink)]">Notifications</p>
          </div>
          {notes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)]">{n.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </p>
                    </div>
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
