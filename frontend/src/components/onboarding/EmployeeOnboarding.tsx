"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import OnboardingTour from "./OnboardingTour";
import { getToken } from "@/lib/authClient";
import {
  TOUR_VERSION,
  clearTourReplay,
  closeForThisSession,
  employeeTourSteps,
  getTourOutcome,
  isClosedThisSession,
  isReplayRequested,
  saveTourOutcome,
  setTourOutcome,
  type TourOutcome,
} from "@/lib/onboarding";
import type { SessionUser } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL;

// The dashboard shows a "Loading…" placeholder until its data arrives, so the tour
// has to wait for a real anchor before it can point at anything.
//
// This watches for the anchor with a MutationObserver rather than polling for a
// fixed number of tries. An earlier version gave up after 4.5s and lost the race
// on a cold load, where the dashboard can take 15s or more to paint. The timeout
// below only exists to stop observing if the dashboard never renders at all.
const ANCHOR = '[data-tour="dashboard-kpis"]';
const ANCHOR_TIMEOUT_MS = 90_000;

/** Calls `ready` as soon as `selector` exists. Returns a cancel function. */
function whenAnchorAppears(selector: string, ready: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  if (document.querySelector(selector)) { ready(); return () => {}; }

  let settled = false;
  const cancel = () => {
    if (settled) return;
    settled = true;
    observer.disconnect();
    window.clearTimeout(timer);
  };
  const observer = new MutationObserver(() => {
    if (!settled && document.querySelector(selector)) { cancel(); ready(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setTimeout(cancel, ANCHOR_TIMEOUT_MS);
  return cancel;
}

interface OnboardingResponse {
  tour: { status: TourOutcome; version: number; at?: string } | null;
}

/**
 * Decides whether to run the welcome tour, and records the outcome.
 *
 * The rule is simply: every employee sees the tour until they finish it or skip
 * it. Account age is not considered, so someone who registered months ago and has
 * never been offered the tour still gets it.
 *
 * The record lives on the server (User.onboardingState), so settling it in one
 * browser settles it everywhere. localStorage is only a mirror: it stops the tour
 * flashing while the server is being asked, and it preserves an outcome whose
 * upload failed so it can be pushed on the next visit.
 *
 * Starts for employees on their dashboard. The tour then walks itself across the
 * other screens, so once it is running this component stays out of the way until
 * it ends. Closing with Esc leaves it to reappear at the next sign in. A replay
 * requested from Settings overrides everything, including an outcome the server
 * has already recorded.
 */
export default function EmployeeOnboarding({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [running, setRunning] = useState(false);
  // Set once the user has finished or skipped, so navigating afterwards cannot
  // re-run the checks and fire a redundant write.
  const settled = useRef(false);

  useEffect(() => {
    if (user.role !== "employee") return;
    // Already under way: the tour navigates between screens on its own, and this
    // effect re-runs on each of those navigations. Leave it alone.
    if (running) return;
    // Only ever STARTS on the dashboard.
    if (pathname !== "/me/dashboard") return;

    let cancelled = false;
    let cancelWatch: (() => void) | undefined;
    const stop = () => { cancelled = true; cancelWatch?.(); };

    const startWhenReady = () => {
      if (cancelled) return;
      cancelWatch = whenAnchorAppears(ANCHOR, () => { if (!cancelled) setRunning(true); });
    };

    // A replay from Settings overrides every check below, including a tour that
    // was finished moments ago in this same visit. Checked before `settled`
    // because this component lives in the shell and is not remounted by the trip
    // to Settings and back, so that flag would otherwise still be set.
    if (isReplayRequested(user.id)) {
      settled.current = false;
      startWhenReady();
      return stop;
    }

    // Finished or dismissed during this visit: nothing more to do.
    if (settled.current) return stop;

    // Dismissed with Esc a moment ago: leave it until the next sign in.
    if (isClosedThisSession(user.id)) return stop;

    const decide = (d: OnboardingResponse | null) => {
      if (cancelled) return;

      // Could not reach the server. Fall back to the local mirror rather than
      // staying silent, so a new employee is not denied the tour by one failed
      // request. Worst case someone who finished it elsewhere sees it once more.
      if (!d) {
        if (!getTourOutcome(user.id)) startWhenReady();
        return;
      }

      // Already settled for this version of the tour: never show it again, in any
      // browser. Mirrored locally so the next load has the answer immediately.
      // An outcome from an older version does not count, which is the point of
      // bumping TOUR_VERSION.
      if (d.tour && d.tour.version >= TOUR_VERSION) {
        saveTourOutcome(user.id, d.tour.status);
        return;
      }

      // Finished somewhere the write never landed (offline, tab closed too fast).
      // The local mirror is the only record, so push it up now.
      const local = getTourOutcome(user.id);
      if (local) { void reportOutcome(local); return; }

      startWhenReady();
    };

    fetch(`${API}/api/me/onboarding`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? (r.json() as Promise<OnboardingResponse>) : null))
      .then(decide)
      .catch(() => decide(null));

    return stop;
  }, [user.id, user.role, pathname, running]);

  // Record locally first so the tour never reappears while the request is in
  // flight, then persist. A failed write is healed on the next dashboard visit.
  const finish = (outcome: TourOutcome) => {
    settled.current = true;
    setTourOutcome(user.id, outcome);
    setRunning(false);
    void reportOutcome(outcome);
  };

  if (!running) return null;

  return (
    <OnboardingTour
      steps={employeeTourSteps}
      onComplete={() => finish("completed")}
      onSkip={() => finish("skipped")}
      onClose={() => {
        settled.current = true;
        clearTourReplay(user.id);
        closeForThisSession(user.id);
        setRunning(false);
      }}
    />
  );
}

async function reportOutcome(status: TourOutcome) {
  try {
    await fetch(`${API}/api/me/onboarding`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      // The user id comes from the token, never from this body.
      body: JSON.stringify({ tour: { status, version: TOUR_VERSION, at: new Date().toISOString() } }),
    });
  } catch {
    /* healed on the next visit from the local mirror */
  }
}
