/**
 * Server-side tenant isolation.
 *
 * Managers in this system are department-scoped: each one sees their own
 * department and no other (see CLAUDE.md — one manager per department). That
 * rule was enforced on some endpoints and merely assumed on others, which meant
 * a manager could read another department's team data by editing the id in the
 * URL. These helpers are the single place the rule is expressed, so a new
 * endpoint gets it by calling one function rather than by remembering to.
 *
 * Deny-by-default: a manager with no `departmentId` matches NO department. A
 * null on the token is missing data, not a wildcard — treating it as "all"
 * would silently turn any mis-provisioned manager row into an org-wide account.
 * Admins are intentionally unscoped; authors are content-only and are scoped
 * out of employee-level data entirely by the callers.
 */
import { prisma } from "@/lib/db";
import { forbidden, notFound } from "@/server/http";
import type { AuthUser } from "@/lib/verifyToken";

/** Roles that legitimately see across every department. */
const UNSCOPED_ROLES = new Set(["admin"]);

export function isUnscoped(user: AuthUser): boolean {
  return UNSCOPED_ROLES.has(user.role);
}

/**
 * Assert `user` may act on `departmentId`. Throws 403 otherwise.
 *
 * The error message is deliberately identical whether the department exists or
 * merely belongs to someone else — a manager probing ids learns nothing about
 * the org chart from the response.
 */
export function assertDepartmentAccess(user: AuthUser, departmentId: string): void {
  if (isUnscoped(user)) return;
  if (!user.departmentId || user.departmentId !== departmentId) {
    throw forbidden("You do not have access to this department.");
  }
}

/** Boolean form, for callers that need to branch rather than throw. */
export function canAccessDepartment(user: AuthUser, departmentId: string | null): boolean {
  if (isUnscoped(user)) return true;
  return !!departmentId && user.departmentId === departmentId;
}

/**
 * Assert `user` may act on the employee identified by `employeeId`, and return
 * that employee's department.
 *
 * Reads the target's department from the DB rather than trusting anything on the
 * request: the caller's token states who THEY are, never who they may touch.
 * A cross-department target yields 404, not 403, so the endpoint cannot be used
 * to confirm that a given user id exists.
 */
export async function assertEmployeeAccess(
  user: AuthUser,
  employeeId: string
): Promise<{ id: string; departmentId: string | null }> {
  const target = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, departmentId: true },
  });
  if (!target) throw notFound("Employee not found.");

  // Everyone may always act on themselves.
  if (target.id === user.id) return target;

  if (!isUnscoped(user) && !canAccessDepartment(user, target.departmentId)) {
    throw notFound("Employee not found.");
  }
  return target;
}
