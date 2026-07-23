"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Dept { id: string; name: string }

// Reusable "All Departments" selector used across the manager pages.
// Emits "" for all departments, or a departmentId.
export default function DepartmentFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [depts, setDepts] = useState<Dept[]>([]);

  useEffect(() => {
    fetch(`${API}/api/departments`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDepts(Array.isArray(d) ? d : []))
      .catch(() => setDepts([]));
  }, []);

  return (
    <div className="relative">
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-8 text-sm font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]"
      >
        <option value="">All Departments</option>
        {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
    </div>
  );
}
