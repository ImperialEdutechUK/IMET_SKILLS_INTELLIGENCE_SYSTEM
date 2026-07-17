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
        { label: "Reports", href: "/me/reports", icon: BarChart3 },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ],

  manager: [
    {
      title: "Team",
      items: [
        { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
        { label: "Team Skills", href: "/manager/team-skills", icon: Target },
        { label: "Team CPD", href: "/manager/team-cpd", icon: Award },
        { label: "Role Profiles", href: "/manager/roles", icon: UserCog },
        { label: "Skill Gaps", href: "/manager/gaps", icon: BarChart3 },
        { label: "AI Insights", href: "/manager/ai-insights", icon: Sparkles },
        { label: "Reports", href: "/manager/reports", icon: BarChart3 },
      ],
    },
    {
      title: "Personal",
      items: [
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "My Skills", href: "/me/skills", icon: Target },
        { label: "My CPD", href: "/me/cpd", icon: Award },
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
        { label: "Learning", href: "/admin/learning", icon: BookOpen },
        { label: "Skills", href: "/admin/skills", icon: Target },
        { label: "CPD Management", href: "/admin/cpd", icon: Award },
        { label: "AI Recommendations", href: "/admin/recommendations", icon: Sparkles },
        { label: "Reports", href: "/admin/reports", icon: BarChart3 },
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

  author: [
    {
      items: [
        { label: "Dashboard", href: "/author/dashboard", icon: LayoutDashboard },
        { label: "Course Library", href: "/author/library", icon: Library },
        { label: "Add / Import Courses", href: "/author/courses/new", icon: BookOpen },
        { label: "Content Review", href: "/author/review", icon: ClipboardCheck },
        { label: "Categories & Skills", href: "/author/taxonomy", icon: Tags },
        { label: "Reports", href: "/author/reports", icon: BarChart3 },
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


// Department-scoped nav (Model 1): shown when a manager is inside a department.
export function departmentNav(departmentId: string): NavSection[] {
  const base = `/manager/departments/${departmentId}`;
  return [
    {
      title: "Department",
      items: [
        { label: "Overview", href: base, icon: LayoutDashboard },
        { label: "Team Skills", href: `${base}/team-skills`, icon: Target },
        { label: "Team CPD", href: `${base}/team-cpd`, icon: Award },
        { label: "Team Learning", href: `${base}/team-learning`, icon: BookOpen },
        { label: "Skill Gaps", href: `${base}/gaps`, icon: BarChart3 },
      ],
    },
    {
      title: "Personal",
      items: [
        { label: "My Learning", href: "/me/learning", icon: BookOpen },
        { label: "My Skills", href: "/me/skills", icon: Target },
        { label: "My CPD", href: "/me/cpd", icon: Award },
        { label: "Settings", href: "/me/settings", icon: Settings },
      ],
    },
  ];
}
