import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import OnboardingLauncher from "@/components/onboarding/OnboardingLauncher";
import type { SessionUser } from "@/types";

export default function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--page)]">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      {/* First-run guided tour, one per role. Renders nothing unless this user
          is due one (and nothing at all for roles without a tour). */}
      <OnboardingLauncher user={user} />
    </div>
  );
}
