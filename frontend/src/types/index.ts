import type { LucideIcon } from "lucide-react";

export type Role = "employee" | "manager" | "admin" | "author";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  department: string;
  avatarUrl?: string | null;
}
