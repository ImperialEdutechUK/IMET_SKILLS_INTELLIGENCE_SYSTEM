import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/layout/DashboardShell";
import type { SessionUser } from "@/types";

/**
 * Second, non-bypassable auth check. proxy.ts already gates routes at the
 * edge, but CVE-2025-29927 showed proxy/middleware-only checks can be
 * bypassed via a spoofed header. This Server Component check runs on the
 * actual Node server for every dashboard page and can't be skipped the
 * same way, so it stays even though proxy.ts covers the common case.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status === "invited") redirect("/set-password");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { department: true },
  });
  if (!dbUser) redirect("/login");

  const user: SessionUser = {
    id: dbUser.id,
    fullName: dbUser.fullName,
    email: dbUser.email,
    role: dbUser.role as SessionUser["role"],
    department: dbUser.department?.name ?? "",
    avatarUrl: dbUser.avatarUrl,
  };

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
