"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Upload, CheckCircle2, AlertCircle, Loader2, Star,
  ArrowRight, RotateCcw, Download, ChevronDown, Flag, MessagesSquare,
} from "lucide-react";
import { getToken } from "@/lib/authClient";

// ── Types (mirror the backend responses) ──────────────────────────────────────

interface QuestionOption { value: string; label: string; hint?: string }
interface Question { id: string; prompt: string; help?: string; multiSelect: boolean; options: QuestionOption[] }
interface DocState { type: string; uploaded: boolean; status: string | null; name: string | null }
interface ChatConfig {
  employeeName: string;
  roleTitle: string | null;
  hasRoleProfile: boolean;
  gapCount: number;
  ai: { provider: string | null; configured: boolean };
  questions: Question[];
  documents: DocState[];
  recommendations: Recommendation[];
}
interface Recommendation {
  rank: number; courseId: string; title: string; provider: string | null; source: string;
  category: string; level: string | null; durationHours: number | null; cpdHours: number;
  rating: number | null; externalUrl: string | null; matchScore: number; matchLabel: string;
  reason: string; reasonSource: string; gapsCovered: { skill: string; from: string; to: string }[];
  preferenceMatches: string[];
}
interface ChatResult {
  aiProvider: string | null; aiExplained: boolean; generated: number;
  recommendations: Recommendation[]; note?: string;
}

type Bubble =
  | { id: number; role: "bot"; text: string }
  | { id: number; role: "user"; text: string };

const DOC_META: Record<string, { label: string; blurb: string; template: string }> = {
  SKILL_MATRIX: { label: "Skills Matrix", blurb: "Your current skill levels", template: "/templates/skills-matrix-template.xlsx" },
  CPD_RECORD: { label: "CPD Log", blurb: "Courses & CPD hours", template: "/templates/cpd-log-template.xlsx" },
  DAILY_REPORT: { label: "Daily Report", blurb: "What you work on day to day", template: "/templates/daily-report-template.xlsx" },
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function RecommendationChatPage() {
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [flowIndex, setFlowIndex] = useState(0); // 0 = uploads, 1..N = questions
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [docs, setDocs] = useState<Record<string, DocState>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ChatResult | null>(null);
  // Results board only: docks the conversation into a side panel that can be
  // collapsed to give the recommendations the full width.
  const [convoCollapsed, setConvoCollapsed] = useState(false);

  const bubbleId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false); // guards against React StrictMode's double-invoke
  const nextId = () => ++bubbleId.current;

  const addBot = (text: string) => setBubbles((b) => [...b, { id: nextId(), role: "bot", text }]);
  const addUser = (text: string) => setBubbles((b) => [...b, { id: nextId(), role: "user", text }]);

  // Load config + kick off the scripted conversation. Runs exactly once — the
  // ref guard stops StrictMode (and any re-render) from replaying the intro.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    fetch(`${API}/api/recommendations/chat`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((cfg: ChatConfig) => {
        setConfig(cfg);
        const dmap: Record<string, DocState> = {};
        cfg.documents.forEach((d) => (dmap[d.type] = d));
        setDocs(dmap);

        const first = cfg.employeeName?.split(" ")[0] ?? "there";

        // If we already have picks from a previous session, re-show them straight
        // away instead of restarting the conversation (survives page refreshes).
        if (cfg.recommendations?.length) {
          addBot(`Welcome back, ${first}. Here ${cfg.recommendations.length === 1 ? "is the course" : `are the ${cfg.recommendations.length} courses`} I recommended for you last time. Hit “Start over” for a fresh set.`);
          setResult({
            aiProvider: cfg.ai.provider,
            aiExplained: false,
            generated: cfg.recommendations.length,
            recommendations: cfg.recommendations,
          });
          return;
        }

        addBot(`Hi ${first} — I'm your course advisor. I only do one thing: recommend courses that fit your role and close your skill gaps.`);
        if (cfg.roleTitle && cfg.hasRoleProfile) {
          addBot(`I can see you're a ${cfg.roleTitle}${cfg.gapCount > 0 ? ` with ${cfg.gapCount} skill gap${cfg.gapCount === 1 ? "" : "s"} to work on` : ""}. Let's find the right courses.`);
        }
        addBot("First — you can upload your Skills Matrix, CPD Log and Daily Report (Excel). I'll read them to sharpen my picks. This is optional; skip whenever you're ready.");
      })
      .catch(() => setLoadError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to newest bubble / control.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, generating, result, flowIndex]);

  const questions = config?.questions ?? [];
  const currentQuestion: Question | null =
    flowIndex >= 1 && flowIndex <= questions.length ? questions[flowIndex - 1] : null;

  // ── Flow control ─────────────────────────────────────────────────────────────

  function advance(from: number, ans: Record<string, string | string[]>) {
    const next = from + 1;
    setFlowIndex(next);
    setMultiSel([]);
    if (next >= 1 && next <= questions.length) {
      const q = questions[next - 1];
      addBot(q.help ? `${q.prompt}\n${q.help}` : q.prompt);
    } else if (next > questions.length) {
      // Pass the merged answers explicitly — React state hasn't flushed yet.
      void generate(ans);
    }
  }

  function answerQuestion(q: Question, values: string[]) {
    const labels = values
      .map((v) => q.options.find((o) => o.value === v)?.label ?? v)
      .join(", ");
    addUser(labels || "No preference");
    const merged = { ...answers, [q.id]: q.multiSelect ? values : values[0] };
    setAnswers(merged);
    advance(flowIndex, merged);
  }

  async function uploadDoc(type: string, file: File) {
    setUploading(type);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    try {
      const res = await fetch(`${API}/api/me/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setDocs((d) => ({ ...d, [type]: { type, uploaded: true, status: data.status, name: data.originalName } }));
        const label = DOC_META[type]?.label ?? type;
        addBot(
          data.status === "PROCESSED"
            ? `Got your ${label}${data.stored ? ` — I picked up ${data.stored} skill signal${data.stored === 1 ? "" : "s"}` : ""}. Thanks!`
            : `Got your ${label}. I've filed it${config?.ai.configured ? "" : " — automatic reading needs an AI key set, so your manager may review it"}.`
        );
      } else {
        addBot(`I couldn't read that file (${data.error ?? "upload failed"}). An .xlsx, .xls or .csv works best.`);
      }
    } catch {
      addBot("Something went wrong uploading that file. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  async function generate(finalAnswers: Record<string, string | string[]>) {
    setGenerating(true);
    addBot("Analysing your role, documents and skill gaps to shortlist the best courses…");
    try {
      const res = await fetch(`${API}/api/recommendations/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ answers: finalAnswers, limit: 5 }),
      });
      const data: ChatResult = await res.json();
      if (!res.ok) {
        addBot("I hit a snag generating recommendations. Please try again.");
      } else if (data.recommendations.length === 0) {
        addBot(data.note ?? "I couldn't find suitable courses right now.");
        // No picks (e.g. no skills on record yet) — still flip to the result state
        // so "Start over" appears, letting the employee head back to the upload
        // step to add skills or documents. The empty list renders nothing.
        setResult(data);
      } else {
        // A note alongside results renders as a banner on the results board, so
        // it isn't duplicated into the transcript here.
        addBot(
          `Here ${data.recommendations.length === 1 ? "is the course" : `are the ${data.recommendations.length} courses`} I'd recommend:`
        );
        setResult(data);
      }
    } catch {
      addBot("I hit a snag generating recommendations. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function startOver() {
    setAnswers({});
    setMultiSel([]);
    setResult(null);
    setConvoCollapsed(false);
    addUser("Start over");
    // Return to the upload step (flowIndex 0), not straight to the questions —
    // documents change over time (new CPD entries, updated skills), so let the
    // employee refresh them before we re-shortlist. Continue advances to Q1.
    setFlowIndex(0);
    addBot("Let's start fresh. If your Skills Matrix, CPD Log or Daily Report have changed since last time, upload the latest versions so I can factor them in — otherwise just hit Continue.");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Couldn&apos;t load the advisor. Please sign in again.</p>
      </div>
    );
  }

  // Board mode: once picks exist the conversation docks into a collapsible side
  // panel and the recommendations take the stage as a ranked list. An empty
  // result (e.g. no skills on record) stays in chat mode so the advisor's
  // message + Start over are front and centre.
  const showBoard = !!result && result.recommendations.length > 0;

  return (
    <div className={`mx-auto flex flex-col ${showBoard ? "max-w-6xl" : "h-[calc(100vh-8rem)] max-w-3xl"}`}>
      {/* Header — Start over lives here (the intro copy points users to it) */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[var(--ink)]">AI Recommendations</h1>
            <p className="text-xs text-[var(--muted)]">Grounded in your skills, gaps and CPD.</p>
          </div>
        </div>
        {result && (
          <button onClick={startOver} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> Start over
          </button>
        )}
      </div>

      {showBoard ? (
        <div className={convoCollapsed ? "" : "grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]"}>
          {/* Conversation — docked side panel, collapsible */}
          {convoCollapsed ? (
            <div className="mb-3">
              <button
                onClick={() => setConvoCollapsed(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50"
              >
                <MessagesSquare className="h-3.5 w-3.5 text-[var(--brand)]" /> Show conversation
              </button>
            </div>
          ) : (
            <aside className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white lg:sticky lg:top-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Conversation</span>
                <button onClick={() => setConvoCollapsed(true)} className="text-xs font-medium text-[var(--brand)] hover:underline">
                  Collapse
                </button>
              </div>
              <div ref={scrollRef} className="max-h-[60vh] space-y-2.5 overflow-y-auto bg-slate-50/60 p-3">
                {bubbles.map((b) =>
                  b.role === "bot" ? (
                    <div key={b.id} className="max-w-[92%] whitespace-pre-line rounded-xl rounded-tl-sm border border-[var(--border)] bg-white px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
                      {b.text}
                    </div>
                  ) : (
                    <div key={b.id} className="flex justify-end">
                      <div className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white">{b.text}</div>
                    </div>
                  )
                )}
              </div>
            </aside>
          )}

          {/* Results */}
          <section className="min-w-0">
            {result.note && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-800">
                <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{result.note}</span>
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
              <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-sm font-bold text-[var(--ink)]">Recommended for you</h2>
                <span className="text-xs text-[var(--muted)]">
                  {result.recommendations.length} course{result.recommendations.length === 1 ? "" : "s"}, ranked by fit
                </span>
              </div>
              {result.recommendations.map((rec) => (
                <CourseRow key={rec.courseId} rec={rec} defaultOpen={rec.rank === 1} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--border)] bg-slate-50/60 p-4">
            {!config && <Typing />}
            {bubbles.map((b) =>
              b.role === "bot" ? (
                <BotBubble key={b.id} text={b.text} />
              ) : (
                <UserBubble key={b.id} text={b.text} />
              )
            )}

            {generating && <Typing />}
          </div>

          {/* Composer — always a fixed set of choices, never free text */}
          <div className="mt-3">
            {config && !generating && !result && flowIndex === 0 && (
              <UploadPanel
                docs={docs}
                uploading={uploading}
                onUpload={uploadDoc}
                onContinue={() => { addUser("Continue"); advance(0, answers); }}
              />
            )}

            {config && !generating && !result && currentQuestion && (
              <QuestionPanel
                question={currentQuestion}
                multiSel={multiSel}
                setMultiSel={setMultiSel}
                onAnswer={answerQuestion}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Bubbles ───────────────────────────────────────────────────────────────────

function BotBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-white">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-sm border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--ink)]">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--brand)] px-4 py-2.5 text-sm text-white">
        {text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-2 text-[var(--muted)]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-white">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
      <span className="text-sm">Thinking…</span>
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────────────

function UploadPanel({
  docs, uploading, onUpload, onContinue,
}: {
  docs: Record<string, DocState>;
  uploading: string | null;
  onUpload: (type: string, file: File) => void;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {Object.entries(DOC_META).map(([type, meta]) => {
          const d = docs[type];
          const done = d?.uploaded;
          const busy = uploading === type;
          return (
            <label
              key={type}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition ${
                done ? "border-[var(--brand)] bg-[var(--brand-tint)]" : "border-[var(--border)] hover:bg-slate-50"
              } ${busy ? "opacity-60" : ""}`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(type, f); e.target.value = ""; }}
              />
              <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink)]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" />
                  : done ? <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" />
                  : <Upload className="h-4 w-4 text-[var(--muted)]" />}
                {meta.label}
              </div>
              <span className="text-xs text-[var(--muted)]">{done ? "Uploaded" : meta.blurb}</span>
              <a
                href={meta.template}
                download
                onClick={(e) => e.stopPropagation()}
                title={`Download the ${meta.label} template`}
                className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-dark)] transition hover:bg-[var(--brand)] hover:text-white"
              >
                <Download className="h-3.5 w-3.5" /> Download template
              </a>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={onContinue}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
        >
          Continue <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Question panel (option chips only) ────────────────────────────────────────

function QuestionPanel({
  question, multiSel, setMultiSel, onAnswer,
}: {
  question: Question;
  multiSel: string[];
  setMultiSel: (v: string[]) => void;
  onAnswer: (q: Question, values: string[]) => void;
}) {
  function toggle(value: string) {
    if (value === "any") { setMultiSel(["any"]); return; }
    const without = multiSel.filter((v) => v !== "any");
    setMultiSel(without.includes(value) ? without.filter((v) => v !== value) : [...without, value]);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => {
          const selected = question.multiSelect && multiSel.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => (question.multiSelect ? toggle(opt.value) : onAnswer(question, [opt.value]))}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] text-[var(--ink)] hover:bg-slate-50"
              }`}
              title={opt.hint}
            >
              {opt.label}
              {opt.hint && <span className={`ml-1.5 text-xs ${selected ? "text-white/80" : "text-[var(--muted)]"}`}>· {opt.hint}</span>}
            </button>
          );
        })}
      </div>
      {question.multiSelect && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onAnswer(question, multiSel.length ? multiSel : ["any"])}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Result row (ranked list on the results board) ─────────────────────────────

function CourseRow({ rec, defaultOpen = false }: { rec: Recommendation; defaultOpen?: boolean }) {
  const high = rec.matchLabel === "high";
  const top = rec.rank === 1;
  // Additive only: enrol this recommended course so it appears in My Learning and
  // its progress can be tracked. Uses the existing enrollments endpoint (which only
  // reads the course + creates an enrollment) — the recommendation engine is untouched.
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const enrol = async () => {
    setEnrolling(true);
    try {
      const r = await fetch(`${API}/api/me/enrollments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: rec.courseId }),
      });
      if (r.ok) setEnrolled(true);
    } catch { /* ignore */ }
    setEnrolling(false);
  };
  // The top pick opens its "why" by default; the rest reveal on demand so the
  // list stays scannable. Skills beyond the first expand inline via "+N more".
  const [showWhy, setShowWhy] = useState(defaultOpen);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const topGap = rec.gapsCovered[0];
  const extraGaps = rec.gapsCovered.length - 1;

  return (
    <div className="relative border-b border-[var(--border)] last:border-b-0">
      {/* The top pick gets a brand accent down its left edge */}
      {top && <span className="absolute inset-y-0 left-0 w-1 bg-[var(--brand)]" aria-hidden />}

      <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-start sm:gap-4">
        {/* Rank */}
        <div className="flex shrink-0 items-center gap-1.5 sm:flex-col sm:gap-0.5 sm:pt-0.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${top ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] bg-slate-50 text-[var(--ink)]"}`}>
            {rec.rank}
          </span>
          {top && <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--brand-dark)]">Top</span>}
        </div>

        {/* Course */}
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-semibold leading-snug text-[var(--ink)]" title={rec.title}>{rec.title}</h4>

          {/* Metadata + skill pills on one wrapping line */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]/70">{rec.provider ?? rec.source}</span>
            <span>· {rec.category}</span>
            {rec.level && <span>· {rec.level}</span>}
            {rec.durationHours != null && <span>· {rec.durationHours}h</span>}
            {rec.cpdHours > 0 && <span>· {rec.cpdHours} CPD</span>}
            {topGap && (
              <span className="rounded-md border border-[var(--brand)]/20 bg-[var(--brand-tint)] px-2 py-0.5 font-medium text-[var(--brand-dark)]">{topGap.skill}: {topGap.from} → {topGap.to}</span>
            )}
            {showAllSkills && rec.gapsCovered.slice(1).map((g) => (
              <span key={g.skill} className="rounded-md border border-[var(--brand)]/20 bg-[var(--brand-tint)] px-2 py-0.5 font-medium text-[var(--brand-dark)]">{g.skill}: {g.from} → {g.to}</span>
            ))}
            {extraGaps > 0 && !showAllSkills && (
              <button onClick={() => setShowAllSkills(true)} className="font-medium text-[var(--brand)] hover:underline">+{extraGaps} more</button>
            )}
          </div>

          {/* Why — hidden until expanded (top pick starts open) */}
          <button onClick={() => setShowWhy((v) => !v)} className="mt-2 flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-dark)]">Why this fits</span>
            <ChevronDown className={`h-3 w-3 text-[var(--brand-dark)] transition-transform ${showWhy ? "rotate-180" : ""}`} />
          </button>
          {showWhy && <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--muted)]">{rec.reason}</p>}
        </div>

        {/* Match + actions */}
        <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:w-48 sm:flex-col sm:items-end">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${high ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-blue-50 text-blue-700"}`}>
              {high ? "High" : "Good"} match
            </span>
            {rec.rating != null ? (
              <span className="flex items-center gap-0.5 text-[11px] font-medium text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{rec.rating}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--muted)]">No ratings yet</span>
            )}
          </div>
          <button
            onClick={enrol}
            disabled={enrolled || enrolling}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition sm:w-full ${enrolled ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"} disabled:opacity-70`}
          >
            {enrolled ? <><CheckCircle2 className="h-3.5 w-3.5" /> Added</> : enrolling ? "Adding…" : "+ Add to My Learning"}
          </button>
          {rec.externalUrl ? (
            <a href={rec.externalUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--brand)]">
              View course <ArrowRight className="h-3 w-3" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]" title="Internal course — ask your L&D team">
              <AlertCircle className="h-3 w-3" /> Internal
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
