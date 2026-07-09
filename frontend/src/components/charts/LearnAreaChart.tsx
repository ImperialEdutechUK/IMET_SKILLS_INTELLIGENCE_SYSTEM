"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataKey {
  key: string;
  label: string;
  color: string;
}

interface LearnAreaChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  dataKeys: DataKey[];
  unit?: string;
  height?: number;
}

export default function LearnAreaChart({
  data,
  xKey,
  dataKeys,
  unit = "completions",
  height = 220,
}: LearnAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {dataKeys.map((dk) => (
            <linearGradient key={dk.key} id={`grad-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={dk.color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={dk.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e6ebe8" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} unit={` ${unit}`} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6ebe8", fontSize: 12 }}
          labelStyle={{ fontWeight: 600, color: "#0f1b2d" }}
        />
        {dataKeys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((dk) => (
          <Area
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.label}
            stroke={dk.color}
            strokeWidth={2.5}
            fill={`url(#grad-${dk.key})`}
            dot={false}
            activeDot={{ r: 5, fill: dk.color }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
