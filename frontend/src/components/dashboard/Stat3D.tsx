import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TONES, type Icon3DTone } from "./Icon3D";

// Colourful Bento stat tile. Tints itself from the given tone so every page that
// uses it becomes part of the bento look with no call-site changes.
export default function Stat3D({
  icon: Icon,
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
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/70">
        <Icon className="h-5 w-5" style={{ color: tone.to }} />
      </span>
      <div className="mt-3">
        <p className="text-[2rem] font-extrabold leading-none" style={{ color: tone.to }}>{value}</p>
        <p className="mt-1.5 text-sm font-medium" style={{ color: tone.to, opacity: 0.85 }}>{label}</p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: tone.to, opacity: 0.7 }}>{sub}</p>}
      </div>
    </>
  );
  const cls = "flex h-full flex-col rounded-2xl p-5";
  return href ? (
    <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md`} style={{ background: `${tone.to}14` }}>{inner}</Link>
  ) : (
    <div className={cls} style={{ background: `${tone.to}14` }}>{inner}</div>
  );
}
