import { Sparkles } from "lucide-react";
import RecommendationCard from "@/components/dashboard/RecommendationCard";
import { myRecommendations } from "@/lib/mock-data";

export default function MyRecommendationsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--brand)]" /><div><h1 className="text-2xl font-bold text-[var(--ink)]">AI Recommendations</h1><p className="mt-1 text-sm text-[var(--muted)]">Personalised courses matched to your profile.</p></div></div>
      <div className="mb-4 flex gap-2">
        {["All", "High Match", "Good Match"].map((f) => (
          <button key={f} className={`rounded-full px-4 py-1.5 text-sm font-medium ${f === "All" ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-slate-50"}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-4">{myRecommendations.map((rec) => <RecommendationCard key={rec.id} {...rec} />)}</div>
    </div>
  );
}
