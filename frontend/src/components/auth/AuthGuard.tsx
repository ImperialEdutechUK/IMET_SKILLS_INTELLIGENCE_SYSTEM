"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getUser, type AuthUser } from "@/lib/authClient";
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
    const ownPrefix = ROLE_PREFIX[u.role];
    const inOwnArea = isMe || (ownPrefix && pathname.startsWith(ownPrefix));
    if (!inOwnArea) {
      router.replace(ownDashboard(u.role));
      return;
    }
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
