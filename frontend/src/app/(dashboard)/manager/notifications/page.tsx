"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, Award, Clock, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// Simple keyword heuristic → icon.
function iconFor(n: Notification): LucideIcon {
  const t = `${n.title} ${n.body}`.toLowerCase();
  if (t.includes("risk") || t.includes("behind") || t.includes("alert") || t.includes("overdue")) return AlertTriangle;
  if (t.includes("complet") || t.includes("achiev") || t.includes("award") || t.includes("certif")) return Award;
  if (t.includes("cpd") || t.includes("hour") || t.includes("due") || t.includes("deadline")) return Clock;
  return Info;
}

export default function ManagerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`${API}/api/notifications`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setNotifications(d.notifications ?? []);
          setUnreadCount(d.unreadCount ?? 0);
          setSelectedId((prev) => prev ?? (d.notifications?.[0]?.id ?? null));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = () => {
    fetch(`${API}/api/notifications`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } })
      .then(() => load())
      .catch(() => {});
  };

  const visible = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const selected = notifications.find((n) => n.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--ink)]">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs font-semibold text-white">{unreadCount} new</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">Stay updated with important alerts and activities.</p>
        </div>
        <button onClick={markAllRead} disabled={unreadCount === 0} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-50">
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "text-[var(--muted)] hover:bg-slate-50"}`}
          >
            {t}{t === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : notifications.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <Bell className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-[var(--muted)]">No notifications yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* List */}
          <div className="rounded-xl border border-[var(--border)] bg-white lg:col-span-1">
            {visible.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">Nothing to show here.</p>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-[var(--border)] overflow-y-auto">
                {visible.map((n) => {
                  const Icon = iconFor(n);
                  const active = n.id === selectedId;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => setSelectedId(n.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${active ? "bg-[var(--brand-tint)]/40" : ""}`}
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-sm ${n.read ? "font-medium text-[var(--ink)]" : "font-semibold text-[var(--ink)]"}`}>{n.title}</span>
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{n.body}</span>
                          <span className="mt-1 block text-xs text-slate-400">{relativeTime(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 lg:col-span-2">
            {!selected ? (
              <p className="text-sm text-[var(--muted)]">Select a notification to read it.</p>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold text-[var(--ink)]">{selected.title}</h2>
                  {!selected.read && (
                    <button onClick={markAllRead} className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                      Mark all read
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{relativeTime(selected.createdAt)}</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">{selected.body}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
