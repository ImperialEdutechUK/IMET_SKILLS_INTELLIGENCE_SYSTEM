import { Sparkles } from "lucide-react";
import RecommendationCard from "@/components/dashboard/RecommendationCard";
import { myRecommendations, aiInsights } from "@/lib/mock-data";

export default function AdminRecommendationsPage() {
  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">AI Recommendations</h1></div><p className="mt-1 text-sm text-[var(--muted)]">System-wide AI recommendations and insights.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">AI Insights</h3>
          <ul className="space-y-3">{aiInsights.map(ins => <li key={ins.id} className="text-sm text-[var(--muted)]">{ins.text}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Recommended Courses</h3>
          <div className="space-y-3">{myRecommendations.slice(0, 2).map(rec => <RecommendationCard key={rec.id} {...rec} compact />)}</div>
        </div>
      </div>
    </div>
  );
}
