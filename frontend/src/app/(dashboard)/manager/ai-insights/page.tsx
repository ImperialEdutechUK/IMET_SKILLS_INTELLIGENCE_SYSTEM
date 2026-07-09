import { Sparkles } from "lucide-react";
import { teamAiInsights } from "@/lib/mock-data";

const iconMap: Record<string, string> = { warning: "⚠️", trend: "📈", suggestion: "💡", achievement: "🏆" };
const bgMap: Record<string, string> = {
  warning: "bg-amber-50 border-amber-200",
  trend: "bg-blue-50 border-blue-200",
  suggestion: "bg-[var(--brand-tint)] border-[var(--border)]",
  achievement: "bg-purple-50 border-purple-200",
};

export default function AiInsightsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[var(--brand)]" />
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">AI Insights</h1><p className="mt-1 text-sm text-[var(--muted)]">AI-powered insights about your team.</p></div>
      </div>
      <div className="space-y-4">
        {teamAiInsights.map((ins) => (
          <div key={ins.id} className={`rounded-xl border p-5 ${bgMap[ins.type]}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{iconMap[ins.type]}</span>
              <p className="text-sm text-[var(--ink)]">{ins.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
