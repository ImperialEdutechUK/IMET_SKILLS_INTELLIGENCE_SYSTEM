"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Segment {
  name: string;
  value: number;
  color: string;
}

interface LearnDonutChartProps {
  data: Segment[];
  label?: string;
  sublabel?: string;
  height?: number;
}

export default function LearnDonutChart({
  data,
  label,
  sublabel,
  height = 160,
}: LearnDonutChartProps) {
  return (
    <div className="flex items-center gap-4">
      <div style={{ height }} className="relative w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="78%"
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e6ebe8", fontSize: 12 }}
              formatter={(v) => [Number(v).toLocaleString(), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        {label && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-[var(--ink)]">{label}</span>
            {sublabel && <span className="text-[10px] text-[var(--muted)]">{sublabel}</span>}
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {data.map((seg) => (
          <li key={seg.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
            <span className="text-[var(--muted)]">{seg.name}</span>
            <span className="ml-auto font-medium text-[var(--ink)]">{seg.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
