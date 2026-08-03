import {
  LayoutDashboard, BookOpen, Target, ScrollText, Sparkles,
  BarChart3, Users, UserCog, UserCheck, Library, ClipboardCheck, Tags, Settings, Trophy, Building2,
} from "lucide-react";
import type { NavSection, Role } from "@/types";

export const navConfig: Record<Role, NavSection[]> = {
  employee: [
    {
      items: [
        { label: "Dashboard", href: "/me/dashboard", icon: LayoutDashboard },
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "My Skills", href: "/me/skills", icon: Target },
        { label: "AI Recommendations", href: "/me/recommendations", icon: Sparkles },
        { label: "Reports", href: "/me/reports", icon: BarChart3 },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],

  manager: [
    {
      title: "Team Statistics",
      items: [
        { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
        { label: "Team Learning", href: "/manager/team-learning", icon: BookOpen },
        { label: "Skills", href: "/manager/team-skills", icon: Target },
        { label: "Leaderboard", href: "/manager/leaderboard", icon: Trophy },
        { label: "Reports", href: "/manager/reports", icon: ScrollText },
      ],
    },
    {
      // Managers learn too: the same personal pages employees get.
      title: "My Learning",
      items: [
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "My Skills", href: "/me/skills", icon: Target },
        { label: "AI Recommendations", href: "/me/recommendations", icon: Sparkles },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],

  admin: [
    {
      title: "Administration",
      items: [
        { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { label: "Departments", href: "/admin/departments", icon: Building2 },
        { label: "User Management", href: "/admin/users", icon: UserCog },
        { label: "Pending Approvals", href: "/admin/approvals", icon: UserCheck },
      ],
    },
    {
      // Admins learn too: the same personal pages employees and managers get.
      title: "My Learning",
      items: [
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "My Skills", href: "/me/skills", icon: Target },
        { label: "AI Recommendations", href: "/me/recommendations", icon: Sparkles },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],

  author: [
    {
      items: [
        { label: "Dashboard", href: "/author/dashboard", icon: LayoutDashboard },
        { label: "Course Library", href: "/author/library", icon: Library },
        { label: "Content Review", href: "/author/review", icon: ClipboardCheck },
        { label: "Categories & Skills", href: "/author/taxonomy", icon: Tags },
      ],
    },
    {
      title: "Personal",
      items: [
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],
};


// HR / Director are the `admin` role (no schema change) but get an org-wide,
// read-only variant of the admin nav — everything except Pending Approvals.
// They are identified by email since there is no separate role.
export const ORG_VIEWER_EMAILS = ["hr@imet.lk", "director@imet.lk"];

export function isOrgViewer(user: { role: string; email: string }): boolean {
  return user.role === "admin" && ORG_VIEWER_EMAILS.includes(user.email.toLowerCase());
}

// Resolve the sidebar nav for a user, applying the HR/Director variant.
export function navFor(user: { role: Role; email: string }): NavSection[] {
  if (isOrgViewer(user)) {
    return navConfig.admin.map((section) => ({
      ...section,
      items: section.items.filter((i) => i.href !== "/admin/approvals"),
    }));
  }
  return navConfig[user.role];
}

// Department-scoped nav (Model 1): shown when a manager is inside a department.
export function departmentNav(departmentId: string): NavSection[] {
  const base = `/manager/departments/${departmentId}`;
  return [
    {
      title: "Department",
      items: [
        { label: "Overview", href: base, icon: LayoutDashboard },
        { label: "Skills", href: `${base}/team-skills`, icon: Target },
        { label: "Learning", href: `${base}/team-learning`, icon: BookOpen },
      ],
    },
  ];
}
