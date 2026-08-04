"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Bell, Compass } from "lucide-react";
import { getUser } from "@/lib/authClient";
import { requestTourReplay, tourFor } from "@/lib/onboarding";
import { useApi, apiSend, ApiError } from "@/lib/api";

interface Profile { fullName: string; email: string; department: string }

export default function SettingsPage() {
  const router = useRouter();
  const { data: profile, isLoading, mutate } = useApi<Profile>("/api/me/profile");
  // `null` = the field is untouched, so it tracks whatever the server last said.
  // Once the user types, their draft wins and a background revalidation can't
  // overwrite what they're editing.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? profile?.fullName ?? "";
  const email = profile?.email ?? "";
  const department = profile?.department ?? "";
  const loaded = !isLoading;
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState(false);
  // Employees, managers and admins each have their own tour; authors have none,
  // so they get no replay card. Read after mount because the session only exists
  // in the browser.
  const [hasTour, setHasTour] = useState(false);

  useEffect(() => {
    const u = getUser();
    setHasTour(!!u && !!tourFor(u));
  }, []);

  const saveName = async () => {
    setSavingName(true); setNameMsg("");
    try {
      const d = await apiSend<Profile>("/api/me/profile", "PATCH", { fullName: name });
      // Write the server's answer into the cache and drop the draft, so the field
      // now reflects what was actually stored rather than what was typed.
      await mutate(d, { revalidate: false });
      setNameDraft(null);
      setNameMsg("Profile saved.");
    } catch (e) {
      setNameMsg(e instanceof ApiError ? e.message : "Could not save.");
    }
    setSavingName(false);
  };

  const savePassword = async () => {
    setSavingPw(true); setPwMsg(""); setPwErr(false);
    try {
      await apiSend("/api/me/password", "POST", { currentPassword: current, newPassword: next });
      setPwMsg("Password updated."); setCurrent(""); setNext("");
    } catch (e) {
      setPwMsg(e instanceof ApiError ? e.message : "Could not update password.");
      setPwErr(true);
    }
    setSavingPw(false);
  };

  // Queue the welcome tour and send the user to the screen it starts on, which
  // differs by role — the tour only ever opens on its own dashboard.
  const replayTour = () => {
    const u = getUser();
    if (!u) return;
    const plan = tourFor(u);
    if (!plan) return;
    requestTourReplay(u.id);
    router.push(plan.startPath);
  };

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Settings</h1><p className="mt-1 text-sm text-[var(--muted)]">Manage your account preferences.</p></div>
      <div className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><User className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Profile</h3></div>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Full Name</label><input value={name} onChange={e => setNameDraft(e.target.value)} disabled={!loaded} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Email</label><input value={email} disabled className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--muted)]" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Department</label><input value={department} disabled className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--muted)]" /></div>
            <div className="flex items-center gap-3">
              <button onClick={saveName} disabled={savingName || !loaded} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50">{savingName ? "Saving…" : "Save Changes"}</button>
              {nameMsg && <span className="text-sm text-[var(--muted)]">{nameMsg}</span>}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
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
        {hasTour && (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
            <div className="mb-4 flex items-center gap-2"><Compass className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Getting started</h3></div>
            <p className="mb-3 text-sm text-[var(--muted)]">Run the guided tour again to see what each part of your dashboard is for.</p>
            <button onClick={replayTour} className="rounded-lg border border-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-dark)] transition-colors hover:bg-[var(--brand-tint)]">Replay the welcome tour</button>
          </div>
        )}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <div className="mb-4 flex items-center gap-2"><Bell className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Notifications</h3></div>
          <p className="mb-3 text-xs text-[var(--muted)]">Notification preferences are not yet configurable.</p>
          {["Course updates", "New recommendations", "Team activity"].map((n) => (
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
