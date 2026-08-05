"use client";

import { useRouter } from "next/navigation";

// A whole-card click target for cards that also contain their own buttons or
// links. The card navigates to `href`; inner interactive elements must call
// e.stopPropagation() so they keep their own behaviour. Keyboard-accessible
// (role=link, Enter/Space), matching the app's focus-visible ring.
export default function ClickableCard({
  href,
  className = "",
  ariaLabel,
  children,
  "data-tour": dataTour,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  "data-tour"?: string;
}) {
  const router = useRouter();
  const go = () => router.push(href);
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      data-tour={dataTour}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </div>
  );
}
