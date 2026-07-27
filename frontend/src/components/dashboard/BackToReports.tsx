"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Shows a "Back to reports" link only when the page was opened from the Reports
// page (via ?from=reports) — so it doesn't appear when reached from the sidebar.
export default function BackToReports() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).get("from") === "reports");
  }, []);
  if (!show) return null;
  return (
    <Link href="/manager/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
      <ArrowLeft className="h-4 w-4" /> Back to reports
    </Link>
  );
}
