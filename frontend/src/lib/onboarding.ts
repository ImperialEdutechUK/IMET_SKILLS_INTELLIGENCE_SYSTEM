"use client";

import {
  BookOpen, CheckCircle2, LayoutDashboard, MousePointerClick, Plus, Sparkles, Target, Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Onboarding tour: step definitions + the state we keep in the browser.
//
// The AUTHORITATIVE record of whether someone has seen the tour is on the server,
// in User.onboardingState (see backend/src/lib/onboarding-state.ts). That is what
// makes the answer the same in Edge, in Chrome and on a phone.
//
// Everything below is browser-local and secondary:
//
//   1. outcome  (localStorage) a mirror of the server's answer. Stops the tour
//      flashing up while the server is still being asked, and preserves an
//      outcome whose upload failed so it can be pushed on the next visit.
//   2. session  (sessionStorage) closed with Esc or the X. Keeps the tour from
//      re-opening each time the user returns to the dashboard in the same
//      sitting, but it WILL open again at the next sign in.
//   3. replay   (localStorage) a one-shot request from Settings to run the tour
//      again, which bypasses everything else including the server's answer.
//
// Keyed by user id, so two people sharing a machine never inherit each other's
// state. Bump TOUR_VERSION when the steps change enough that new joiners should
// see it again; a stored outcome from an older version no longer counts.
// Keep it in step with ONBOARDING_TOUR_VERSION on the backend.

// v3 is hands-on: the user clicks the real menu items and buttons themselves.
export const TOUR_VERSION = 3;

const outcomeKey = (userId: string) => `ls_tour_v${TOUR_VERSION}_outcome:${userId}`;
const sessionKey = (userId: string) => `ls_tour_v${TOUR_VERSION}_closed:${userId}`;
const replayKey = (userId: string) => `ls_tour_v${TOUR_VERSION}_replay:${userId}`;

export type TourOutcome = "completed" | "skipped";

function safeGet(store: "local" | "session", key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null; // private mode / storage disabled: tour just runs every time
  }
}

function safeSet(store: "local" | "session", key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(store: "local" | "session", key: string) {
  if (typeof window === "undefined") return;
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getTourOutcome(userId: string): TourOutcome | null {
  const v = safeGet("local", outcomeKey(userId));
  return v === "completed" || v === "skipped" ? v : null;
}

/** Mirror an outcome locally. Used when echoing what the server already knows. */
export function saveTourOutcome(userId: string, outcome: TourOutcome) {
  safeSet("local", outcomeKey(userId), outcome);
}

/** Record an outcome the user just produced, and retire any replay request. */
export function setTourOutcome(userId: string, outcome: TourOutcome) {
  saveTourOutcome(userId, outcome);
  safeRemove("local", replayKey(userId));
}

export function isClosedThisSession(userId: string): boolean {
  return safeGet("session", sessionKey(userId)) === "1";
}

export function closeForThisSession(userId: string) {
  safeSet("session", sessionKey(userId), "1");
}

// Called from Settings ("Replay the welcome tour").
export function requestTourReplay(userId: string) {
  safeSet("local", replayKey(userId), "1");
  safeRemove("session", sessionKey(userId));
}

export function isReplayRequested(userId: string): boolean {
  return safeGet("local", replayKey(userId)) === "1";
}

export function clearTourReplay(userId: string) {
  safeRemove("local", replayKey(userId));
}

export type Placement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  /** CSS selector for the element to spotlight. Omit for a centred dialogue. */
  target?: string;
  /** Screen this step belongs to. The tour navigates there before showing it. */
  path?: string;
  /** Short chip above the title, e.g. "MY LEARNING". Names the screen. */
  label: string;
  icon: LucideIcon;
  title: string;
  /** One or two short lines. Nobody reads a paragraph in a tooltip. */
  body: string;
  /** Preferred side for the card. The tour flips it if there is no room. */
  placement?: Placement;
  /**
   * "click": the step completes when the user clicks the highlighted element
   * itself — the overlay opens a real hole over it, so the click does what it
   * always does (opens the page, opens the dialog). No "Got it" button is shown.
   */
  advanceOn?: "click";
}

/**
 * The employee tour, hands-on: instead of describing buttons, it highlights them
 * and has the user click them — the sidebar items to move between screens, the
 * real Add Course button to open the real dialog. What they do in the tour is
 * exactly what they will do tomorrow without it.
 *
 * Click-to-advance steps keep `path` set to the screen they START on, because it
 * is the user's own click that performs the navigation.
 */
export const employeeTourSteps: TourStep[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id: "welcome",
    path: "/me/dashboard",
    label: "Welcome",
    icon: Sparkles,
    title: "Let us show you around",
    body: "A quick hands-on tour — you do the clicking. Under a minute.",
    placement: "center",
  },
  {
    id: "dashboard-kpis",
    path: "/me/dashboard",
    target: '[data-tour="dashboard-kpis"]',
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "Your numbers at a glance",
    body: "Certificates, courses, skill gaps. Every card is a shortcut to its full view.",
    placement: "bottom",
  },
  {
    id: "topbar-level",
    path: "/me/dashboard",
    target: '[data-tour="topbar-level"]',
    label: "Progress",
    icon: Trophy,
    title: "Earn XP as you learn",
    body: "Finish courses, unlock badges, climb levels.",
    placement: "bottom",
  },

  // ── My Learning ────────────────────────────────────────────────────────────
  {
    id: "go-learning",
    path: "/me/dashboard",
    target: '[data-tour="sidebar-nav"] a[href="/me/learning"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "Open My Learning",
    body: "Click the highlighted menu item.",
    placement: "right",
    advanceOn: "click",
  },
  {
    id: "learning-tabs",
    path: "/me/learning",
    target: '[data-tour="learning-tabs"]',
    label: "My Learning",
    icon: BookOpen,
    title: "Every course, one place",
    body: "Not started, in progress, completed — plus the certificates you earn.",
    placement: "bottom",
  },
  {
    id: "learning-add",
    path: "/me/learning",
    target: '[data-tour="learning-add"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "Now click Add Course",
    body: "This is how you log a course you are doing outside the recommended list.",
    placement: "bottom",
    advanceOn: "click",
  },
  {
    id: "learning-add-modal",
    path: "/me/learning",
    target: '[data-tour="learning-add-close"]',
    label: "My Learning",
    icon: Plus,
    title: "That is the whole form",
    body: "Name, link, provider, status. Mark it Completed to log CPD hours and attach the certificate. Click the X to close it.",
    placement: "right",
    advanceOn: "click",
  },

  // ── My Skills ──────────────────────────────────────────────────────────────
  {
    id: "go-skills",
    path: "/me/learning",
    target: '[data-tour="sidebar-nav"] a[href="/me/skills"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "Open My Skills",
    body: "Click it — this is where your strengths live.",
    placement: "right",
    advanceOn: "click",
  },
  {
    id: "skills-add",
    path: "/me/skills",
    target: '[data-tour="skills-add"]',
    label: "My Skills",
    icon: Plus,
    title: "Add Skill",
    body: "Rate where you are today and where you want to get to. Works just like Add Course.",
    placement: "bottom",
  },
  {
    id: "skills-tabs",
    path: "/me/skills",
    target: '[data-tour="skills-tabs"]',
    label: "My Skills",
    icon: Target,
    title: "Find your gaps",
    body: "Skills to Improve ranks you against your role, worst gap first.",
    placement: "bottom",
  },

  // ── AI Recommendations ─────────────────────────────────────────────────────
  {
    id: "go-recommendations",
    path: "/me/skills",
    target: '[data-tour="sidebar-nav"] a[href="/me/recommendations"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "One more: AI Recommendations",
    body: "Click it to meet your course advisor.",
    placement: "right",
    advanceOn: "click",
  },
  {
    id: "recommendations",
    path: "/me/recommendations",
    target: '[data-tour="rec-header"]',
    label: "AI Recommendations",
    icon: Sparkles,
    title: "Courses picked for you",
    body: "Answer a couple of questions and it ranks courses against your gaps — add any of them with one click.",
    placement: "bottom",
  },

  // ── Back home ──────────────────────────────────────────────────────────────
  {
    id: "finish",
    path: "/me/dashboard",
    label: "All set",
    icon: CheckCircle2,
    title: "You are ready to go",
    body: "Replay this any time from Settings.",
    placement: "center",
  },
];
