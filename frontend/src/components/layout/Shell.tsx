"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { SessionUser } from "@/types";

// Chrome wrapper holding the mobile-drawer state. On lg+ the sidebar is static;
// below that it slides in over a backdrop, toggled from the top bar's menu button.
export default function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // The app shell is exactly one viewport tall and `main` is the only scroll
  // region. Lock the document itself so the window never gets a second scrollbar
  // (which would scroll the whole app up into the empty body background below).
  // Scoped to the dashboard — auth pages, which render their own scroll, are
  // unaffected because this component only mounts inside the dashboard.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--page)]">
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}
      <Sidebar user={user} mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenu={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
