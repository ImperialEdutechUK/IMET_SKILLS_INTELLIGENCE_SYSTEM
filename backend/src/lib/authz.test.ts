import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthUser } from "./verifyToken";

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const { assertDepartmentAccess, canAccessDepartment, assertEmployeeAccess, isUnscoped } = await import("./authz");

const CDD = "dept-cdd";
const MARKETING = "dept-marketing";

const user = (over: Partial<AuthUser>): AuthUser => ({
  id: "u1",
  email: "a@b.com",
  name: "A",
  role: "manager",
  status: "active",
  departmentId: CDD,
  ...over,
});

beforeEach(() => findUnique.mockReset());

describe("department scoping", () => {
  it("lets a manager into their own department", () => {
    expect(canAccessDepartment(user({}), CDD)).toBe(true);
    expect(() => assertDepartmentAccess(user({}), CDD)).not.toThrow();
  });

  it("keeps a manager out of another department", () => {
    // The regression this exists for: /api/manager/departments/:id and the
    // department skill-gaps endpoint checked the caller's ROLE and nothing else,
    // so any manager could read any department by editing the URL.
    expect(canAccessDepartment(user({}), MARKETING)).toBe(false);
    expect(() => assertDepartmentAccess(user({}), MARKETING)).toThrow();
  });

  it("throws a 403 rather than leaking whether the department exists", () => {
    try {
      assertDepartmentAccess(user({}), MARKETING);
      expect.unreachable();
    } catch (err) {
      expect((err as { status: number }).status).toBe(403);
    }
  });

  it("denies a manager with NO department rather than granting them everything", () => {
    // Deny-by-default: a null departmentId is missing data, not a wildcard.
    const orphan = user({ departmentId: null });
    expect(canAccessDepartment(orphan, CDD)).toBe(false);
    expect(canAccessDepartment(orphan, MARKETING)).toBe(false);
    expect(() => assertDepartmentAccess(orphan, CDD)).toThrow();
  });

  it("lets an admin into any department", () => {
    const admin = user({ role: "admin", departmentId: null });
    expect(isUnscoped(admin)).toBe(true);
    expect(canAccessDepartment(admin, MARKETING)).toBe(true);
    expect(() => assertDepartmentAccess(admin, MARKETING)).not.toThrow();
  });

  it("does not treat author as unscoped", () => {
    const author = user({ role: "author", departmentId: null });
    expect(isUnscoped(author)).toBe(false);
    expect(() => assertDepartmentAccess(author, CDD)).toThrow();
  });
});

describe("assertEmployeeAccess", () => {
  it("allows a manager to act on an employee in their own department", async () => {
    findUnique.mockResolvedValue({ id: "emp1", departmentId: CDD });
    await expect(assertEmployeeAccess(user({}), "emp1")).resolves.toEqual({
      id: "emp1",
      departmentId: CDD,
    });
  });

  it("blocks a manager from an employee in another department", async () => {
    findUnique.mockResolvedValue({ id: "emp2", departmentId: MARKETING });
    await expect(assertEmployeeAccess(user({}), "emp2")).rejects.toThrow();
  });

  it("answers 404 (not 403) for a cross-department target, so ids cannot be probed", async () => {
    findUnique.mockResolvedValue({ id: "emp2", departmentId: MARKETING });
    // A 403 would confirm "this id exists, you just can't have it". 404 makes an
    // out-of-scope employee indistinguishable from one that does not exist.
    await expect(assertEmployeeAccess(user({}), "emp2")).rejects.toMatchObject({ status: 404 });
    findUnique.mockResolvedValue(null);
    await expect(assertEmployeeAccess(user({}), "nope")).rejects.toMatchObject({ status: 404 });
  });

  it("always lets a user act on themselves, whatever their department", async () => {
    findUnique.mockResolvedValue({ id: "u1", departmentId: MARKETING });
    await expect(assertEmployeeAccess(user({ role: "employee" }), "u1")).resolves.toBeTruthy();
  });

  it("lets an admin act on anyone", async () => {
    findUnique.mockResolvedValue({ id: "emp2", departmentId: MARKETING });
    await expect(assertEmployeeAccess(user({ role: "admin" }), "emp2")).resolves.toBeTruthy();
  });

  it("blocks a manager from an employee with no department at all", async () => {
    findUnique.mockResolvedValue({ id: "emp3", departmentId: null });
    await expect(assertEmployeeAccess(user({}), "emp3")).rejects.toThrow();
  });

  it("reads the target's department from the database, never from the caller", async () => {
    findUnique.mockResolvedValue({ id: "emp1", departmentId: CDD });
    await assertEmployeeAccess(user({}), "emp1");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "emp1" },
      select: { id: true, departmentId: true },
    });
  });
});
