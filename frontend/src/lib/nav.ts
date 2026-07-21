import {
  LayoutDashboard, BookOpen, Target, Award, ScrollText, Sparkles,
  BarChart3, Users, UserCog, UserCheck, Library, ClipboardCheck, Tags, Settings,
} from "lucide-react";
import type { NavSection, Role } from "@/types";

export const navConfig: Record<Role, NavSection[]> = {
  employee: [
    {
      items: [
        { label: "Dashboard", href: "/me/dashboard", icon: LayoutDashboard },
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "My Skills", href: "/me/skills", icon: Target },
        { label: "My CPD", href: "/me/cpd", icon: Award },
        { label: "Certificates", href: "/me/certificates", icon: ScrollText },
        { label: "AI Recommendations", href: "/me/recommendations", icon: Sparkles },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],

  manager: [
    {
      title: "Team",
      items: [
        { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
        { label: "Skills", href: "/manager/team-skills", icon: Target },
        { label: "CPD", href: "/manager/team-cpd", icon: Award },
        { label: "Role Profiles", href: "/manager/roles", icon: UserCog },
        { label: "Skill Gaps", href: "/manager/gaps", icon: BarChart3 },
        { label: "AI Insights", href: "/manager/ai-insights", icon: Sparkles },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],

  admin: [
    {
      items: [
        { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { label: "User Management", href: "/admin/users", icon: UserCog },
        { label: "Pending Approvals", href: "/admin/approvals", icon: UserCheck },
        { label: "AI Recommendations", href: "/admin/recommendations", icon: Sparkles },
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
        { label: "My CPD", href: "/me/cpd", icon: Award },
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
        { label: "CPD", href: `${base}/team-cpd`, icon: Award },
        { label: "Learning", href: `${base}/team-learning`, icon: BookOpen },
        { label: "Skill Gaps", href: `${base}/gaps`, icon: BarChart3 },
      ],
    },
  ];
}
