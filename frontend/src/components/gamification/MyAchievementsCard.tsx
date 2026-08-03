"use client";

import AchievementsCard from "@/components/gamification/AchievementsCard";
import { useApi } from "@/lib/api";

// Drop-in gamification card that reads its own inputs (certificates +
// dashboard). Lets any page — including the manager team dashboard — show the
// signed-in user's level/XP with zero wiring. Shares SWR cache entries with the
// top-bar pill and the employee dashboard, so it adds no extra requests.
export default function MyAchievementsCard() {
  const { data: certs, isLoading: certsLoading } = useApi<{ certificates: unknown[] }>("/api/me/certificates");
  const { data: dash, isLoading: dashLoading } = useApi<{ completedCount: number; cpdHours: number }>("/api/me/dashboard");

  // Render nothing only while both are genuinely empty — once either is cached
  // the card appears immediately and fills in the rest on arrival.
  if (certsLoading && dashLoading) return null;

  return (
    <AchievementsCard
      certificates={certs?.certificates?.length ?? 0}
      coursesCompleted={dash?.completedCount ?? 0}
      cpdHours={dash?.cpdHours ?? 0}
    />
  );
}
