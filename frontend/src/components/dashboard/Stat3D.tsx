import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import Icon3D, { TONES, type Icon3DTone } from "./Icon3D";

// Shared 3D stat tile used across the manager dashboard for a consistent look.
// Renders as a link when `href` is given, otherwise a plain card.
export default function Stat3D({
  icon,
  tone = TONES.emerald,
  label,
  value,
  sub,
  href,
}: {
  icon: LucideIcon;
  tone?: Icon3DTone;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <>
      <Icon3D icon={icon} tone={tone} />
      <p className="mt-3 text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none text-[var(--ink)]">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[var(--muted)]">{sub}</p>}
    </>
  );
  const cls = "block h-full rounded-xl border border-[var(--border)] bg-white p-5";
  return href ? (
    <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
