"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getUser, type AuthUser } from "@/lib/authClient";
import { swrCache } from "@/lib/swr-cache";
import DashboardShell from "@/components/layout/DashboardShell";
import type { SessionUser } from "@/types";

const ROLE_PREFIX: Record<string, string> = {
  employee: "/me",
  manager: "/manager",
  admin: "/admin",
  author: "/author",
};

function ownDashboard(role: string) {
  return role === "employee" ? "/me/dashboard" : `/${role}/dashboard`;
}

/**
 * Routes every signed-in role may reach, outside their own role area: the
 * global search results page behind the top-bar box, and the course catalogue
 * browser. Both are read-only views of data that belongs to nobody in
 * particular, so there is one page rather than one copy per role.
 */
const SHARED_ROUTES = ["/search", "/courses"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    if (u.status === "invited") {
      router.replace("/set-password");
      return;
    }
    const isMe = pathname.startsWith("/me");
    const isShared = SHARED_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
    const ownPrefix = ROLE_PREFIX[u.role];
    const inOwnArea = isMe || isShared || (ownPrefix && pathname.startsWith(ownPrefix));
    if (!inOwnArea) {
      router.replace(ownDashboard(u.role));
      return;
    }
    // Point the SWR cache at this user's bucket *before* any dashboard screen
    // renders, so the first paint can come from their cached data — and never
    // from the previous account's.
    swrCache.activate(u.id);
    setUser(u);
    setChecked(true);
  }, [pathname, router]);

  if (!checked || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--page)]">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  const sessionUser: SessionUser = {
    id: user.id,
    fullName: user.name,
    email: user.email,
    role: user.role as SessionUser["role"],
    department: user.department,
    avatarUrl: user.avatarUrl,
  };

  return <DashboardShell user={sessionUser}>{children}</DashboardShell>;
}
