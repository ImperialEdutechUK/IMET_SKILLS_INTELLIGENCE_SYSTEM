import { Sparkles, Star, ArrowRight, RefreshCw } from "lucide-react";

interface RecommendationCardProps {
  title: string;
  source: string;
  category: string;
  matchLabel: string;
  reason?: string;
  cpd_hours?: number;
  rating?: number;
  externalUrl?: string;
  compact?: boolean;
}

export default function RecommendationCard({
  title,
  source,
  category,
  matchLabel,
  reason,
  cpd_hours,
  rating,
  externalUrl = "#",
  compact = false,
}: RecommendationCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-[var(--ink)]">{title}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${matchLabel === "high" ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-blue-50 text-blue-700"}`}>
              {matchLabel === "high" ? "High Match" : "Good Match"}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">{source} · {category}</p>
        </div>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
          View Course
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--ink)]">{title}</h4>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${matchLabel === "high" ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-blue-50 text-blue-700"}`}>
              {matchLabel === "high" ? "High Match" : "Good Match"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{source} · {category}</p>
          {reason && <p className="mt-2 text-xs text-[var(--muted)]">{reason}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {rating && (
              <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {rating}
              </span>
            )}
            {cpd_hours && <span className="text-xs text-[var(--muted)]">{cpd_hours} CPD hours</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          View Course <ArrowRight className="h-3.5 w-3.5" />
        </a>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-slate-50" title="Get alternative">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
