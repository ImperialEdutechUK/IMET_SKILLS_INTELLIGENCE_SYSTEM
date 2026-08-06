"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { clearAuth } from "@/lib/authClient";
import { swrCache } from "@/lib/swr-cache";
import type { SessionUser } from "@/types";

// Settings is the same page for every role — see navConfig in lib/nav.ts.
const SETTINGS_HREF = "/me/settings";

type Variant = "topbar" | "sidebar";

/**
 * The account menu behind both profile avatars: the compact one in the top bar
 * and the full account row at the foot of the sidebar. Same items, same
 * behaviour — only the trigger and the drop direction differ, so the two never
 * drift apart.
 */
export default function ProfileMenu({
  user,
  variant,
  onNavigate,
}: {
  user: SessionUser;
  variant: Variant;
  /** Lets the mobile drawer close itself when a menu item navigates. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Roving focus across the menu items, in DOM order.
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Close on outside click — matches NotificationBell's mousedown convention so
  // the two header popovers behave identically.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A navigation always dismisses the menu (Settings, or a link elsewhere in the
  // shell while it happens to be open).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Opening hands focus to the first item, so the whole menu is reachable from
  // the keyboard without a mouse ever touching it.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function focusItem(index: number) {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (items.length === 0) return;
    items[(index + items.length) % items.length].focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    } else if (e.key === "Tab") {
      // Tabbing out of a menu closes it, but must not steal the focus move.
      setOpen(false);
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function logOut() {
    setOpen(false);
    clearAuth();
    swrCache.clear();
    onNavigate?.();
    router.push("/login");
  }

  const menuId = `account-menu-${variant}`;
  const inSidebar = variant === "sidebar";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={inSidebar ? undefined : `Account menu for ${user.fullName}`}
        title={inSidebar ? undefined : user.fullName}
        className={
          inSidebar
            ? `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`
            : `grid h-9 w-9 shrink-0 place-items-center rounded-full transition-shadow hover:ring-2 hover:ring-[var(--brand-tint)] ${open ? "ring-2 ring-[var(--brand-tint)]" : ""}`
        }
      >
        <Avatar name={user.fullName} size={36} />
        {inSidebar && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--ink)]">{user.fullName}</span>
              <span className="block truncate text-xs capitalize text-[var(--muted)]">{user.role}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className={`absolute z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg ${
            inSidebar ? "bottom-full left-0 right-0 mb-2" : "right-0 mt-2 w-64"
          }`}
        >
          {/* Identity first: which account am I about to act on? */}
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{user.fullName}</p>
            <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] font-medium capitalize text-[var(--brand-dark)]">
              {user.role}
              {user.department ? ` · ${user.department}` : ""}
            </p>
          </div>

          <div className="p-1.5">
            <Link
              ref={(el) => { itemRefs.current[0] = el; }}
              href={SETTINGS_HREF}
              role="menuitem"
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-slate-50 focus:bg-slate-50"
            >
              <Settings className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
              Settings
            </Link>
            <button
              ref={(el) => { itemRefs.current[1] = el; }}
              type="button"
              role="menuitem"
              onClick={logOut}
              className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
