"use client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  departmentId: string | null;
  department: string;
  avatarUrl: string | null;
}

const TOKEN_KEY = "ls_token";
const USER_KEY = "ls_user";

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function dashboardPathFor(user: AuthUser): string {
  if (user.status === "invited") return "/set-password";
  switch (user.role) {
    case "admin": return "/admin/dashboard";
    case "manager": return "/manager/dashboard";
    case "author": return "/author/dashboard";
    case "employee": return "/me/dashboard";
    default: return "/me/dashboard";
  }
}
