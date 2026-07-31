"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MousePointerClick, X } from "lucide-react";
import type { Placement, TourStep } from "@/lib/onboarding";

/**
 * A guided product tour: dims the screen, spotlights one element at a time and
 * explains it in a compact dialogue with a "Got it" button.
 *
 * Steps can live on different screens. When a step names a `path`, the tour
 * navigates there itself and waits for that step's anchor to render before
 * pointing at it. The tour is mounted in the dashboard shell, which survives
 * client-side navigation, so its state carries across pages.
 *
 * Steps with `advanceOn: "click"` are hands-on: the overlay opens a real hole
 * over the highlighted element, the user clicks the element itself, and whatever
 * that element normally does happens for real (navigation, opening a dialog).
 * The step advances on that click, so the user learns by doing.
 *
 * Presentation only. Deciding who sees the tour and remembering the outcome is
 * the caller's job (see EmployeeOnboarding).
 */

const CARD_WIDTH = 348;
const EDGE = 16; // keep the card this far from the viewport edge
const GAP = 14; // distance between the spotlight and the card
const SPOTLIGHT_PAD = 6;
// How long to wait for a step's element after walking to its screen. Pages in
// this app can take well over ten seconds to fetch their data on a cold load.
const ANCHOR_WAIT_MS = 20_000;

interface Rect { top: number; left: number; width: number; height: number }

// Type scale for the dialogue. Fixed pixel values rather than utility classes so
// the tour reads identically wherever it is mounted.
const TYPE = {
  chip: { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const },
  title: { fontSize: 17, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" },
  body: { fontSize: 13.5, fontWeight: 400, lineHeight: 1.55 },
  button: { fontSize: 13, fontWeight: 600 },
  quiet: { fontSize: 12.5, fontWeight: 500 },
  count: { fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" as const },
};

function readRect(selector: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null; // rendered but empty
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Place the card beside the spotlight, flipping to whichever side has room. */
function placeCard(
  rect: Rect | null,
  card: { width: number; height: number },
  view: { width: number; height: number },
  preferred: Placement | undefined,
): { top: number; left: number } {
  const clamp = (p: { top: number; left: number }) => ({
    top: Math.min(Math.max(p.top, EDGE), Math.max(EDGE, view.height - card.height - EDGE)),
    left: Math.min(Math.max(p.left, EDGE), Math.max(EDGE, view.width - card.width - EDGE)),
  });

  if (!rect || preferred === "center") {
    return clamp({
      top: (view.height - card.height) / 2,
      left: (view.width - card.width) / 2,
    });
  }

  const midX = rect.left + rect.width / 2 - card.width / 2;
  const midY = rect.top + rect.height / 2 - card.height / 2;
  const order: Placement[] = ["bottom", "top", "right", "left"];
  const tries = preferred ? [preferred, ...order.filter((p) => p !== preferred)] : order;

  for (const side of tries) {
    if (side === "bottom" && rect.top + rect.height + GAP + card.height <= view.height - EDGE) {
      return clamp({ top: rect.top + rect.height + GAP, left: midX });
    }
    if (side === "top" && rect.top - GAP - card.height >= EDGE) {
      return clamp({ top: rect.top - GAP - card.height, left: midX });
    }
    if (side === "right" && rect.left + rect.width + GAP + card.width <= view.width - EDGE) {
      return clamp({ top: midY, left: rect.left + rect.width + GAP });
    }
    if (side === "left" && rect.left - GAP - card.width >= EDGE) {
      return clamp({ top: midY, left: rect.left - GAP - card.width });
    }
  }

  // Nothing fits cleanly: sit under the target and let the clamp sort it out.
  return clamp({ top: rect.top + rect.height + GAP, left: midX });
}

export default function OnboardingTour({
  steps,
  onComplete,
  onSkip,
  onClose,
}: {
  steps: TourStep[];
  /** Reached the end of the tour. */
  onComplete: () => void;
  /** Chose to skip. The tour should not come back. */
  onSkip: () => void;
  /** Dismissed with Esc. Fine to show again on the next sign in. */
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Drop any step whose anchor is missing, so the step count is always honest.
  // Only steps for the page we are on can be judged: a step on another screen is
  // kept, because its anchor cannot exist until we navigate there.
  const [visible, setVisible] = useState<TourStep[]>([]);
  useEffect(() => {
    const here = window.location.pathname;
    setVisible(
      steps.filter((s) => {
        if (!s.target) return true;
        if (s.path && s.path !== here) return true;
        return readRect(s.target) !== null;
      }),
    );
    // Intentionally only on mount: the list must stay stable for the whole run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [cardHeight, setCardHeight] = useState(190);
  // Set when an anchor has taken too long to appear, so a step whose element never
  // renders cannot strand the user on a dead "Got it" button.
  const [anchorGaveUp, setAnchorGaveUp] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const step = visible[index];
  const isFirst = index === 0;
  const isLast = index === visible.length - 1;

  const measure = useCallback(() => {
    // Scrolling fires this often, so only touch state when something moved.
    setView((v) =>
      v.width === window.innerWidth && v.height === window.innerHeight
        ? v
        : { width: window.innerWidth, height: window.innerHeight },
    );
    const nextRect = step?.target ? readRect(step.target) : null;
    setRect((r) =>
      r === nextRect ||
      (r && nextRect && r.top === nextRect.top && r.left === nextRect.left &&
        r.width === nextRect.width && r.height === nextRect.height)
        ? r
        : nextRect,
    );
  }, [step]);

  // Walk to the screen this step lives on.
  useEffect(() => {
    if (step?.path && step.path !== pathname) router.push(step.path);
  }, [step, pathname, router]);

  // Bring the anchor into view, then track it while the page settles.
  useEffect(() => {
    if (!step) return;
    if (step.target) {
      document.querySelector(step.target)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    measure();
    const timers = [60, 180, 360, 600].map((ms) => window.setTimeout(measure, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [step, measure]);

  // A targeted step with nothing measured yet, which is the normal state right
  // after navigating to a screen that is still fetching: watch the DOM and grab
  // the anchor the moment it renders.
  useEffect(() => {
    if (!step?.target || rect) return;
    const selector = step.target;
    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) return;
      document.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "smooth" });
      measure();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Some pages here take many seconds to load, so allow a generous wait before
    // conceding and letting the user move on without a highlight.
    const bail = window.setTimeout(() => setAnchorGaveUp(true), ANCHOR_WAIT_MS);
    return () => { observer.disconnect(); window.clearTimeout(bail); };
  }, [step, rect, measure]);

  // Every step starts out willing to wait again.
  useEffect(() => { setAnchorGaveUp(false); }, [index]);

  // Follow layout changes, including scrolling inside the main content area.
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step, view.width]);

  // Move focus onto the dialogue so keyboard and screen-reader users start here.
  // view.width is in the deps because the card is not in the DOM until the first
  // measurement lands, so the very first step would otherwise miss its focus.
  useEffect(() => {
    primaryRef.current?.focus();
  }, [index, step, view.width, rect]);

  // Lock background scrolling for the duration of the tour.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const next = useCallback(() => {
    if (isLast) onComplete();
    else setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Hands-on steps: advance when the user clicks the highlighted element itself.
  // Capture phase on the document, deferred a beat so the element's own handler
  // (the navigation, the dialog opening) has run before the tour moves on.
  useEffect(() => {
    if (step?.advanceOn !== "click" || !step.target || !rect) return;
    const selector = step.target;
    const onDocClick = (e: MouseEvent) => {
      const el = document.querySelector(selector);
      if (el && e.target instanceof Node && el.contains(e.target)) {
        window.setTimeout(next, 120);
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [step, rect, next]);

  useEffect(() => {
    if (!step) return; // nothing measured yet
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") {
        e.preventDefault();
        // On a hands-on step the arrow performs the real click, so a keyboard
        // user gets the same navigation/dialog the mouse click would produce.
        if (step?.advanceOn === "click" && step.target) {
          const el = document.querySelector<HTMLElement>(step.target);
          if (el) { el.click(); return; } // the click listener advances the step
        }
        next();
      }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "Tab") {
        // Keep tabbing inside the dialogue.
        const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!focusable || focusable.length === 0) return;
        const list = Array.from(focusable);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, next, back, onClose]);

  if (!step || view.width === 0) return null;

  const cardWidth = Math.min(CARD_WIDTH, view.width - EDGE * 2);
  const pos = placeCard(rect, { width: cardWidth, height: cardHeight }, view, step.placement);
  const StepIcon = step.icon;

  // The step names an element but the screen has not produced it yet. Hold "Got
  // it" until the highlight is actually on the element, otherwise a quick clicker
  // reads about the Add Course button and never sees which button that is.
  const waitingForAnchor = !!step.target && !rect && !anchorGaveUp;

  const spotlight = rect
    ? {
        top: rect.top - SPOTLIGHT_PAD,
        left: rect.left - SPOTLIGHT_PAD,
        width: rect.width + SPOTLIGHT_PAD * 2,
        height: rect.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  // Hands-on step, ready to be clicked: the overlay needs a real hole.
  const clickable = step.advanceOn === "click" && !!spotlight;

  return (
    <div className="onboarding-tour" style={{ fontFamily: "var(--font-ui)" }}>
      {/* Swallows clicks on the app while the tour is running. On a hands-on step
          it is four panels AROUND the highlight, leaving a genuine gap so the one
          element the user is asked to click stays clickable. */}
      {clickable && spotlight ? (
        <>
          <div className="fixed z-[190]" aria-hidden="true" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotlight.top) }} />
          <div className="fixed z-[190]" aria-hidden="true" style={{ top: spotlight.top, left: 0, width: Math.max(0, spotlight.left), height: spotlight.height }} />
          <div className="fixed z-[190]" aria-hidden="true" style={{ top: spotlight.top, left: spotlight.left + spotlight.width, right: 0, height: spotlight.height }} />
          <div className="fixed z-[190]" aria-hidden="true" style={{ top: spotlight.top + spotlight.height, left: 0, right: 0, bottom: 0 }} />
        </>
      ) : (
        <div className="fixed inset-0 z-[190]" aria-hidden="true" onClick={(e) => e.preventDefault()} />
      )}

      {/* The dim layer. With an anchor it is the spotlight's outer shadow, so the
          anchor itself stays at full brightness; without one it covers the page. */}
      {spotlight ? (
        <div
          aria-hidden="true"
          className="tour-spotlight pointer-events-none fixed z-[195] rounded-xl"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(9, 20, 33, 0.58)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 z-[195]" style={{ background: "rgba(9, 20, 33, 0.58)" }} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-card fixed z-[200] overflow-hidden rounded-xl bg-white"
        style={{
          top: pos.top,
          left: pos.left,
          width: cardWidth,
          boxShadow: "0 18px 44px -12px rgba(9, 20, 33, 0.34), 0 0 0 1px rgba(9, 20, 33, 0.06)",
        }}
      >
        {/* Progress rail across the very top: position without anything to read. */}
        <div className="h-[3px] w-full bg-[var(--brand-tint)]">
          <div
            className="tour-rail h-full rounded-r-full bg-[var(--brand)]"
            style={{ width: `${((index + 1) / visible.length) * 100}%` }}
          />
        </div>

        {/* Content is keyed by step so it re-animates on every move. */}
        <div key={step.id} className="tour-body">
          <div className="flex items-start gap-3 px-4 pt-3.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
              <StepIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ ...TYPE.chip, color: "var(--brand)" }}>{step.label}</p>
              <h2 id="tour-title" className="mt-1" style={{ ...TYPE.title, color: "var(--ink)" }}>{step.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the tour"
              className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p id="tour-body" className="px-4 pb-4 pt-2" style={{ ...TYPE.body, color: "var(--muted)" }}>
            {step.body}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span style={{ ...TYPE.count, color: "var(--muted)" }}>{index + 1}/{visible.length}</span>
            <button
              type="button"
              onClick={onSkip}
              style={TYPE.quiet}
              className="rounded-md px-1 py-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              Skip
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={back}
                aria-label="Back"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-2 text-[var(--muted)] transition-colors hover:bg-slate-50 hover:text-[var(--ink)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {clickable ? (
              // No "Got it" here: the user's click on the highlighted element is
              // what moves the tour on. The pill just tells them so.
              <span
                style={TYPE.button}
                className="tour-click-hint inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-tint)] px-3.5 py-2 text-[var(--brand-dark)]"
              >
                <MousePointerClick className="h-4 w-4" /> Click the highlight
              </span>
            ) : (
              <button
                ref={primaryRef}
                type="button"
                onClick={next}
                disabled={waitingForAnchor}
                style={TYPE.button}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3.5 py-2 text-white transition-colors hover:bg-[var(--brand-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 disabled:hover:bg-[var(--brand)]"
              >
                {waitingForAnchor ? (
                  <><span className="tour-dot h-1.5 w-1.5 rounded-full bg-white" /> Opening</>
                ) : isFirst ? (
                  <>Start <ArrowRight className="h-3.5 w-3.5" /></>
                ) : isLast ? (
                  <><Check className="h-3.5 w-3.5" /> Got it</>
                ) : (
                  <>Got it <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
