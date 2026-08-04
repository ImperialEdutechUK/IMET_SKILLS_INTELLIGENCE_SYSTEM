"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Menu, X } from "lucide-react";

// The landing header. Kept as a small client island so the marketing page stays
// server-rendered while the mobile menu button actually works.
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--brand)] text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <p className="text-xl font-extrabold tracking-tight">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
        </Link>

        <nav className="hidden items-center gap-10 text-[15px] font-medium lg:flex">
          <a href="#features" className="transition-opacity hover:opacity-60">Features</a>
          <a href="#how" className="transition-opacity hover:opacity-60">How it works</a>
          <Link href="/login" className="transition-opacity hover:opacity-60">Sign in</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/register" className="hidden rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] sm:inline-block">Get started</Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-slate-100 lg:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-[var(--border)] bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4 text-[15px] font-medium">
            <a href="#features" onClick={close} className="rounded-xl px-3 py-3 transition-colors hover:bg-slate-50">Features</a>
            <a href="#how" onClick={close} className="rounded-xl px-3 py-3 transition-colors hover:bg-slate-50">How it works</a>
            <Link href="/login" onClick={close} className="rounded-xl px-3 py-3 transition-colors hover:bg-slate-50">Sign in</Link>
            <Link href="/register" onClick={close} className="mt-2 rounded-full bg-[var(--brand)] px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-[var(--brand-dark)]">Get started</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
