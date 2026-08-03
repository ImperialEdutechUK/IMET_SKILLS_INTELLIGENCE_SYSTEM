"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface BarDatum {
  name: string;
  value: number;
  color?: string;
}

// Vertical bar chart in the app's light/green theme. Used for per-department
// comparisons (e.g. CPD %). A `highlightName` lifts one bar to full colour while
// dimming the rest — mirrors the cross-highlight of the analytics reference.
export default function LearnBarChart({
  data,
  unit = "",
  height = 220,
  color = "#3f9d75",
  highlightName = null,
}: {
  data: BarDatum[];
  unit?: string;
  height?: number;
  color?: string;
  highlightName?: string | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,45,.06)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "rgba(15,27,45,.08)" }} interval={0} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(63,157,117,.06)" }}
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
          formatter={(v) => [`${v}${unit}`, ""]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} formatter={(v) => `${v}${unit}`} />
          {data.map((d) => {
            const dim = highlightName != null && d.name !== highlightName;
            return <Cell key={d.name} fill={d.color ?? color} fillOpacity={dim ? 0.28 : 1} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
