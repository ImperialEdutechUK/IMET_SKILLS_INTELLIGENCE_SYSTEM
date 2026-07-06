interface BarListItem {
  name: string;
  value: number;
  max?: number;
  color?: string;
}

export default function BarList({
  items,
  unit = "%",
  max = 100,
}: {
  items: BarListItem[];
  unit?: string;
  max?: number;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.min(100, ((item.value) / (item.max ?? max)) * 100);
        return (
          <li key={item.name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-[var(--ink)]">{item.name}</span>
              <span className="text-sm font-medium text-[var(--ink)]">{item.value}{unit}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: item.color ?? "var(--brand)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
