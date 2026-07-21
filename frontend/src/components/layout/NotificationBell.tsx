"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { getToken } from "@/lib/authClient";

interface Note {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NotificationBell() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setNotes(d.notifications ?? []);
      setUnread(d.unreadCount ?? 0);
    } catch {
      /* ignore — bell stays quiet if offline */
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // light poll
    return () => clearInterval(id);
  }, []);

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
      // Opening the panel counts as seen → mark all read.
      setUnread(0);
      setNotes((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        await fetch(`${API}/api/notifications`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
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
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
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
