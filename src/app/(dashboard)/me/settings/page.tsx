"use client";
import { useState } from "react";
import { User, Lock, Bell } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("Emma Watson");

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Settings</h1><p className="mt-1 text-sm text-[var(--muted)]">Manage your account preferences.</p></div>
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><User className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Profile</h3></div>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Full Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Email</label><input value="emma.watson@imet.lk" disabled className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--muted)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Department</label><input value="CDD" disabled className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--muted)]" /></div>
            <button className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">Save Changes</button>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><Lock className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Change Password</h3></div>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Current Password</label><input type="password" placeholder="••••••••" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New Password</label><input type="password" placeholder="••••••••" className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <button className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">Update Password</button>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><Bell className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Notifications</h3></div>
          {["Course updates", "CPD reminders", "New recommendations", "Team activity"].map((n) => (
            <div key={n} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-sm text-[var(--ink)]">{n}</span>
              <div className="relative h-6 w-11 rounded-full bg-[var(--brand)]"><span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
