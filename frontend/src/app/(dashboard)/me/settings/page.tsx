"use client";

import { useEffect, useState } from "react";
import { User, Lock, Bell } from "lucide-react";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/me/profile`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setName(d.fullName); setEmail(d.email); setDepartment(d.department); } setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const saveName = async () => {
    setSavingName(true); setNameMsg("");
    try {
      const r = await fetch(`${API}/api/me/profile`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name }),
      });
      const d = await r.json();
      if (r.ok) { setName(d.fullName); setNameMsg("Profile saved."); }
      else setNameMsg(d.error ?? "Could not save.");
    } catch { setNameMsg("Could not save."); }
    setSavingName(false);
  };

  const savePassword = async () => {
    setSavingPw(true); setPwMsg(""); setPwErr(false);
    try {
      const r = await fetch(`${API}/api/me/password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await r.json();
      if (r.ok) { setPwMsg("Password updated."); setCurrent(""); setNext(""); }
      else { setPwMsg(d.error ?? "Could not update password."); setPwErr(true); }
    } catch { setPwMsg("Could not update password."); setPwErr(true); }
    setSavingPw(false);
  };

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Settings</h1><p className="mt-1 text-sm text-[var(--muted)]">Manage your account preferences.</p></div>
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><User className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Profile</h3></div>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Full Name</label><input value={name} onChange={e => setName(e.target.value)} disabled={!loaded} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Email</label><input value={email} disabled className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--muted)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Department</label><input value={department} disabled className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--muted)]" /></div>
            <div className="flex items-center gap-3">
              <button onClick={saveName} disabled={savingName || !loaded} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50">{savingName ? "Saving…" : "Save Changes"}</button>
              {nameMsg && <span className="text-sm text-[var(--muted)]">{nameMsg}</span>}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><Lock className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Change Password</h3></div>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Current Password</label><input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New Password</label><input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="At least 8 characters" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div className="flex items-center gap-3">
              <button onClick={savePassword} disabled={savingPw || !current || !next} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50">{savingPw ? "Updating…" : "Update Password"}</button>
              {pwMsg && <span className={`text-sm ${pwErr ? "text-red-600" : "text-[var(--brand)]"}`}>{pwMsg}</span>}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><Bell className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Notifications</h3></div>
          <p className="mb-3 text-xs text-[var(--muted)]">Notification preferences are not yet configurable.</p>
          {["Course updates", "CPD reminders", "New recommendations", "Team activity"].map((n) => (
            <div key={n} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-sm text-[var(--muted)]">{n}</span>
              <div className="relative h-6 w-11 rounded-full bg-slate-200"><span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
