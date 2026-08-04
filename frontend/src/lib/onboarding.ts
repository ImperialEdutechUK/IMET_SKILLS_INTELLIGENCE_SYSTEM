"use client";

import {
  BellRing, BookOpen, Building2, CheckCircle2, Download, LayoutDashboard, MousePointerClick,
  Plus, ScrollText, ShieldCheck, Sparkles, Target, TrendingUp, Trophy, UserCheck, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isOrgViewer } from "@/lib/nav";

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

/**
 * The manager tour. Same hands-on shape as the employee one, but it walks the
 * team screens: the health ring first (the one number a manager should read),
 * then the two screens the ring is made of, then Reports.
 *
 * Two of its anchors are conditional — the reminder button only exists when
 * somebody is behind pace. A step whose anchor is missing on the screen the tour
 * starts on is dropped before the run begins, so the count stays honest.
 */
export const managerTourSteps: TourStep[] = [
  // ── Team dashboard ─────────────────────────────────────────────────────────
  {
    id: "mgr-welcome",
    path: "/manager/dashboard",
    label: "Welcome",
    icon: Sparkles,
    title: "Let us show you around",
    body: "A quick hands-on tour of your team tools — you do the clicking. Under a minute.",
    placement: "center",
  },
  {
    id: "mgr-health",
    path: "/manager/dashboard",
    target: '[data-tour="mgr-health"]',
    label: "Team dashboard",
    icon: ShieldCheck,
    title: "Your team's health, in one ring",
    body: "How many people are on pace with their learning. Read this first — the rest of the page explains it.",
    placement: "bottom",
  },
  {
    id: "mgr-remind",
    path: "/manager/dashboard",
    target: '[data-tour="mgr-remind"]',
    label: "Team dashboard",
    icon: BellRing,
    title: "Nudge whoever is behind",
    body: "One click puts a reminder on the dashboard of every team member off pace.",
    placement: "bottom",
  },
  {
    id: "mgr-kpis",
    path: "/manager/dashboard",
    target: '[data-tour="mgr-kpis"]',
    label: "Team dashboard",
    icon: LayoutDashboard,
    title: "Key numbers",
    body: "Active learners, courses, average skill level. Every tile opens the screen behind it.",
    placement: "top",
  },

  // ── Team Learning ──────────────────────────────────────────────────────────
  {
    id: "mgr-go-learning",
    path: "/manager/dashboard",
    target: '[data-tour="sidebar-nav"] a[href="/manager/team-learning"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "Open Team Learning",
    body: "Click the highlighted menu item.",
    placement: "right",
    advanceOn: "click",
  },
  {
    id: "mgr-learning-table",
    path: "/manager/team-learning",
    target: '[data-tour="mgr-learning-table"]',
    label: "Team Learning",
    icon: BookOpen,
    title: "Everyone, course by course",
    body: "Search for a person, open their gap count to see which skills they are short on, or click a name for the full record.",
    placement: "top",
  },
  {
    id: "mgr-learning-export",
    path: "/manager/team-learning",
    target: '[data-tour="mgr-learning-export"]',
    label: "Team Learning",
    icon: Download,
    title: "Take the table away",
    body: "Export gives you the same rows as a CSV for a spreadsheet or a review meeting.",
    placement: "left",
  },

  // ── Team Skills ────────────────────────────────────────────────────────────
  {
    id: "mgr-go-skills",
    path: "/manager/team-learning",
    target: '[data-tour="sidebar-nav"] a[href="/manager/team-skills"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "Now open Skills",
    body: "Click it — this is where the gaps live.",
    placement: "right",
    advanceOn: "click",
  },
  {
    id: "mgr-skills-gaps",
    path: "/manager/team-skills",
    target: '[data-tour="mgr-skills-gaps"]',
    label: "Team Skills",
    icon: Target,
    title: "Where the team is short",
    body: "The skills most of your people are behind on. This is what to plan training around.",
    placement: "left",
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  {
    id: "mgr-go-reports",
    path: "/manager/team-skills",
    target: '[data-tour="sidebar-nav"] a[href="/manager/reports"]',
    label: "Try it",
    icon: MousePointerClick,
    title: "One more: Reports",
    body: "Click it to see what you can hand upwards.",
    placement: "right",
    advanceOn: "click",
  },
  {
    id: "mgr-report-cards",
    path: "/manager/reports",
    target: '[data-tour="mgr-report-cards"]',
    label: "Reports",
    icon: ScrollText,
    title: "Reports you can share",
    body: "Open one for the detail, or export the lot as CSV from the top of the page.",
    placement: "bottom",
  },

  // ── Your own learning ──────────────────────────────────────────────────────
  {
    id: "mgr-personal",
    path: "/manager/reports",
    target: '[data-tour="sidebar-personal"]',
    label: "Your learning",
    icon: Trophy,
    title: "You are a learner too",
    body: "My Learning, My Skills and AI Recommendations work for you exactly as they do for your team.",
    placement: "right",
  },
  {
    id: "mgr-finish",
    path: "/manager/dashboard",
    label: "All set",
    icon: CheckCircle2,
    title: "You are ready to go",
    body: "Replay this any time from Settings.",
    placement: "center",
  },
];

/**
 * The admin tour. Org-wide rather than one department: the verdict, the
 * departments to drill into, then the two screens admins actually work in —
 * the roster and the approvals queue.
 *
 * `includeApprovals` is false for the HR/Director variant of the admin role,
 * which has no Pending Approvals item in its sidebar (see `isOrgViewer`). The
 * approvals steps are left out entirely rather than pointing at a menu item
 * that will never appear.
 */
export function adminTourSteps(includeApprovals: boolean): TourStep[] {
  const approvals: TourStep[] = [
    {
      id: "adm-go-approvals",
      path: "/admin/users",
      target: '[data-tour="sidebar-nav"] a[href="/admin/approvals"]',
      label: "Try it",
      icon: MousePointerClick,
      title: "One more: Pending Approvals",
      body: "Click it — new registrations wait here.",
      placement: "right",
      advanceOn: "click",
    },
    {
      id: "adm-approvals",
      path: "/admin/approvals",
      target: '[data-tour="adm-approvals"]',
      label: "Pending Approvals",
      icon: UserCheck,
      title: "Approve or reject, one by one",
      body: "Employees register themselves and cannot sign in until you approve them here.",
      placement: "top",
    },
  ];

  // Where the tour has ended up by the time it points at the personal section.
  const lastPath = includeApprovals ? "/admin/approvals" : "/admin/users";

  return [
    // ── Organisation dashboard ───────────────────────────────────────────────
    {
      id: "adm-welcome",
      path: "/admin/dashboard",
      label: "Welcome",
      icon: Sparkles,
      title: "Let us show you around",
      body: "A quick hands-on tour of the admin screens — you do the clicking. Under a minute.",
      placement: "center",
    },
    {
      id: "adm-verdict",
      path: "/admin/dashboard",
      target: '[data-tour="adm-verdict"]',
      label: "Organisation",
      icon: ShieldCheck,
      title: "The whole organisation, in one line",
      body: "The headline verdict, then the bar splitting everyone into on track, behind pace and at risk.",
      placement: "bottom",
    },
    {
      id: "adm-departments",
      path: "/admin/dashboard",
      target: '[data-tour="adm-departments"]',
      label: "Organisation",
      icon: Building2,
      title: "Departments, worst first",
      body: "Whoever needs attention sits at the top. Open one to see its people.",
      placement: "top",
    },
    {
      id: "adm-insights",
      path: "/admin/dashboard",
      target: '[data-tour="adm-insights"]',
      label: "Organisation",
      icon: TrendingUp,
      title: "Completions and the biggest gaps",
      body: "Six months of completions on the left, the skills to invest in on the right.",
      placement: "top",
    },

    // ── User management ──────────────────────────────────────────────────────
    {
      id: "adm-go-users",
      path: "/admin/dashboard",
      target: '[data-tour="sidebar-nav"] a[href="/admin/users"]',
      label: "Try it",
      icon: MousePointerClick,
      title: "Open User Management",
      body: "Click the highlighted menu item.",
      placement: "right",
      advanceOn: "click",
    },
    {
      id: "adm-users-summary",
      path: "/admin/users",
      target: '[data-tour="adm-users-summary"]',
      label: "User Management",
      icon: UserCog,
      title: "Who is on the platform",
      body: "Totals across every department. The pending figure is a link — it takes you to the approvals queue.",
      placement: "bottom",
    },
    {
      id: "adm-users-roster",
      path: "/admin/users",
      target: '[data-tour="adm-users-roster"]',
      label: "User Management",
      icon: UserCog,
      title: "The roster, by department",
      body: "Search by name, department or role. Click an employee to open their record.",
      placement: "top",
    },

    // ── Approvals (skipped for the HR/Director variant) ──────────────────────
    ...(includeApprovals ? approvals : []),

    // ── Your own learning ────────────────────────────────────────────────────
    {
      id: "adm-personal",
      path: lastPath,
      target: '[data-tour="sidebar-personal"]',
      label: "Your learning",
      icon: Trophy,
      title: "You are a learner too",
      body: "My Learning, My Skills and AI Recommendations are yours as well, not just the employees'.",
      placement: "right",
    },
    {
      id: "adm-finish",
      path: "/admin/dashboard",
      label: "All set",
      icon: CheckCircle2,
      title: "You are ready to go",
      body: "Replay this any time from Settings.",
      placement: "center",
    },
  ];
}

export interface TourPlan {
  steps: TourStep[];
  /** The only screen the tour is allowed to START on. */
  startPath: string;
  /**
   * An element that only exists once that screen has finished loading its data.
   * The tour waits for it, so it never opens over a "Loading…" placeholder.
   */
  readyAnchor: string;
}

/**
 * The tour this user should be offered, or null if their role has none.
 *
 * One tour per role, and a user has one role, so all three share the single
 * `tour` record in User.onboardingState — finishing the manager tour settles
 * onboarding for that manager the same way the employee tour does for an
 * employee. Authors have no tour yet and are simply left alone.
 */
export function tourFor(user: { role: string; email: string }): TourPlan | null {
  switch (user.role) {
    case "employee":
      return {
        steps: employeeTourSteps,
        startPath: "/me/dashboard",
        readyAnchor: '[data-tour="dashboard-kpis"]',
      };
    case "manager":
      return {
        steps: managerTourSteps,
        startPath: "/manager/dashboard",
        readyAnchor: '[data-tour="mgr-health"]',
      };
    case "admin":
      return {
        steps: adminTourSteps(!isOrgViewer(user)),
        startPath: "/admin/dashboard",
        readyAnchor: '[data-tour="adm-verdict"]',
      };
    default:
      return null;
  }
}
