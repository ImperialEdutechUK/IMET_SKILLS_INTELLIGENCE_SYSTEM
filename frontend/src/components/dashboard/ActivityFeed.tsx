import { BookOpen, Award, Clock, BarChart3 } from "lucide-react";

interface ActivityItem {
  id: string;
  type?: string;
  user?: string;
  action: string;
  time: string;
}

const iconMap: Record<string, React.ElementType> = {
  course_complete: Award,
  course_start: BookOpen,
  cpd: Clock,
  skill: BarChart3,
  course: BookOpen,
  default: BookOpen,
};

export default function ActivityFeed({
  items,
  title = "Recent Activity",
  href = "#",
}: {
  items: ActivityItem[];
  title?: string;
  href?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--ink)]">{title}</h3>
        <a href={href} className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
          View All
        </a>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const Icon = iconMap[item.type ?? "default"] ?? BookOpen;
          return (
            <li key={item.id} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--ink)]">
                  {item.user && <span className="font-medium">{item.user} </span>}
                  {item.action}
                </p>
                <p className="text-xs text-[var(--muted)]">{item.time}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
