"use client";

import { useState, useEffect } from "react";
import { UserCheck, Check, X, Mail, Briefcase, Building2, Clock } from "lucide-react";

interface Pending {
  id: string;
  fullName: string;
  email: string;
  position: string | null;
  department: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/approvals");
      const data = res.ok ? await res.json() : [];
      setPending(Array.isArray(data) ? data : []);
    } catch {
      setPending([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function act(userId: string, action: "approve" | "reject") {
    setActing(userId);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        setPending((prev) => prev.filter((p) => p.id !== userId));
      }
    } catch {
      // no-op; row stays if the request failed
    }
    setActing(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Pending Approvals</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review and approve new employee registrations before they can sign in.</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <UserCheck className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--ink)]">No pending registrations</p>
          <p className="mt-1 text-sm text-[var(--muted)]">New employee registrations will appear here for approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="rounded-xl border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-sm font-semibold text-[var(--brand-dark)]">
                    {p.fullName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--ink)]">{p.fullName}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>
                      {p.position && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {p.position}</span>}
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.department}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(p.id, "approve")}
                    disabled={acting === p.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => act(p.id, "reject")}
                    disabled={acting === p.id}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
