import Shell from "./Shell";
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
    <>
      <Shell user={user}>{children}</Shell>
      {/* First-run guided tour, one per role. Renders nothing unless this user
          is due one (and nothing at all for roles without a tour). */}
      <OnboardingLauncher user={user} />
    </>
  );
}
