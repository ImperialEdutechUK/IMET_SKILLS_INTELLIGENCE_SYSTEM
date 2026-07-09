interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ name, size = 32, className = "" }: AvatarProps) {
  const parts = name.split(" ").filter(Boolean);
  const initials = parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className={`inline-grid place-items-center rounded-full bg-[var(--brand-tint)] font-semibold text-[var(--brand-dark)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </span>
  );
}
