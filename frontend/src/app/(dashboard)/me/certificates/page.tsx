"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Certificates were merged into My Learning (the "Certificates" tab). This page is
// kept only so old links/bookmarks land in the right place instead of 404-ing.
export default function CertificatesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/me/learning?tab=certificates");
  }, [router]);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
      <p className="text-sm text-[var(--muted)]">Taking you to My Learning…</p>
    </div>
  );
}
