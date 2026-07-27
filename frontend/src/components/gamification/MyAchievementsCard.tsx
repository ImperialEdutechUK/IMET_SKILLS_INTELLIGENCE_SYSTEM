"use client";

import { useEffect, useState } from "react";
import AchievementsCard from "@/components/gamification/AchievementsCard";
import { getToken } from "@/lib/authClient";
import type { GamInput } from "@/lib/gamification";

const API = process.env.NEXT_PUBLIC_API_URL;

// Drop-in gamification card that fetches its own inputs from already-deployed
// endpoints (certificates + dashboard). Lets any page — including the manager
// team dashboard — show the signed-in user's level/XP with zero wiring.
export default function MyAchievementsCard() {
  const [input, setInput] = useState<GamInput | null>(null);

  useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${getToken()}` } };
    Promise.all([
      fetch(`${API}/api/me/certificates`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API}/api/me/dashboard`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([certs, dash]) => {
      setInput({
        certificates: certs?.certificates?.length ?? 0,
        coursesCompleted: dash?.completedCount ?? 0,
        cpdHours: dash?.cpdHours ?? 0,
      });
    });
  }, []);

  if (!input) return null;
  return <AchievementsCard {...input} />;
}
