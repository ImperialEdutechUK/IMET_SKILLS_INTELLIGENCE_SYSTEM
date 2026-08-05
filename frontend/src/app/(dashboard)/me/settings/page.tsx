"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Bell, Compass, ChevronDown } from "lucide-react";
import { getUser } from "@/lib/authClient";
import { requestTourReplay, tourFor } from "@/lib/onboarding";
import { useApi, apiSend, ApiError } from "@/lib/api";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { MAX_PASSWORD_LENGTH, PASSWORD_HINT, passwordMeetsRules } from "@/lib/password-rules";

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
    // Centred rather than flush-left: this page is two columns of cards, so on a
    // wide screen a left-aligned block leaves a lopsided gutter down the right.
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Settings</h1><p className="mt-1 text-sm text-[var(--muted)]">Manage your account preferences.</p></div>
      {/* No `items-start`: grid items stretch, so the two cards in a row share a
          height and their bottom edges line up. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader icon={User} title="Profile" />
          <div className="space-y-4">
            <Field label="Full Name" htmlFor="fullName">
              <input id="fullName" value={name} onChange={e => setNameDraft(e.target.value)} disabled={!loaded} className={inputClass} />
            </Field>
            <Field label="Email" htmlFor="email">
              <input id="email" value={email} disabled className={`${inputClass} bg-slate-50 text-[var(--muted)]`} />
            </Field>
            {/* Department is org data, not a preference: manager dashboards and
                approvals are scoped by it, so it is shown in its settled state
                rather than offered as something the account holder can pick. */}
            <Field label="Department" htmlFor="department">
              <div className="relative">
                <select id="department" disabled title="Your department is set by an administrator." className={`${inputClass} appearance-none pr-10 disabled:text-[var(--ink)]`}>
                  <option>{department}</option>
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              </div>
            </Field>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={saveName} disabled={savingName || !loaded} className={primaryButtonClass}>{savingName ? "Saving…" : "Save Changes"}</button>
              {nameMsg && <span className="text-sm text-[var(--muted)]">{nameMsg}</span>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Lock} title="Change Password" />
          <div className="space-y-4">
            <Field label="Current Password" htmlFor="currentPassword">
              <input id="currentPassword" type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" placeholder="••••••••" className={inputClass} />
            </Field>
            <Field label="New Password" htmlFor="newPassword">
              <input id="newPassword" type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" maxLength={MAX_PASSWORD_LENGTH} placeholder={PASSWORD_HINT} className={inputClass} />
              {/* This form previously promised only "At least 8 characters" and
                  checked nothing, so the server's real policy arrived as a
                  surprise rejection after the user had already committed. The
                  hint holds the space until there is something to check. */}
              {next
                ? <PasswordChecklist value={next} />
                : <p className="mt-1.5 text-xs text-[var(--muted)]">Use a mix of letters, numbers, and symbols for a stronger password.</p>}
            </Field>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={savePassword} disabled={savingPw || !current || !passwordMeetsRules(next)} className={primaryButtonClass}>{savingPw ? "Updating…" : "Update Password"}</button>
              {pwMsg && <span className={`text-sm ${pwErr ? "text-red-600" : "text-[var(--brand)]"}`}>{pwMsg}</span>}
            </div>
          </div>
        </Card>

        {hasTour && (
          <Card>
            <CardHeader icon={Compass} title="Getting started" />
            <p className="mb-4 text-sm text-[var(--muted)]">Run the guided tour again to see what each part of your dashboard is for.</p>
            <button onClick={replayTour} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-dark)]">Replay the welcome tour</button>
          </Card>
        )}

        <Card>
          <CardHeader icon={Bell} title="Notifications" />
          <p className="text-xs text-[var(--muted)]">Notification preferences are not yet configurable.</p>
          <div className="mt-4">
            {["Course updates", "New recommendations", "Team activity"].map((n) => (
              <div key={n} className="flex items-center justify-between border-t border-[var(--border)] py-3.5">
                <span className="text-sm text-[var(--muted)]">{n}</span>
                {/* Decorative, not a control: nothing behind these yet, so they
                    are not focusable and announce their disabled state. */}
                <span role="switch" aria-checked="false" aria-disabled="true" aria-label={n} className="relative h-6 w-11 shrink-0 rounded-full border border-[var(--border)] bg-white">
                  <span className="absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,27,45,0.2)]" />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand)] disabled:cursor-default";

const primaryButtonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-40";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-white p-6">{children}</div>;
}

function CardHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Icon className="h-4 w-4" /></span>
      <h3 className="text-base font-semibold text-[var(--ink)]">{title}</h3>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[var(--ink)]">{label}</label>
      {children}
    </div>
  );
}
