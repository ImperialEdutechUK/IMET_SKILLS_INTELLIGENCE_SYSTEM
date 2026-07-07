import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import type { Role } from "@/types";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register", "/set-password", "/forgot-password"];

const ROLE_PREFIX: Record<Role, string> = {
  employee: "/me",
  manager: "/manager",
  admin: "/admin",
  author: "/author",
};

function ownDashboard(role: Role) {
  return role === "employee" ? "/me/dashboard" : `/${role}/dashboard`;
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  if (path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  const user = req.auth?.user as { role?: Role; status?: string } | undefined;
  if (!user) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (user.status === "invited" && !path.startsWith("/set-password")) {
    return NextResponse.redirect(new URL("/set-password", nextUrl));
  }

  if (user.role) {
    const isMe = path.startsWith("/me");
    const ownPrefix = ROLE_PREFIX[user.role];
    const inOwnArea = isMe || path.startsWith(ownPrefix);
    if (!inOwnArea) {
      return NextResponse.redirect(new URL(ownDashboard(user.role), nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)"],
};
