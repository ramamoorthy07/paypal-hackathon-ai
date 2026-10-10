"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Chat", icon: "💬" },
  { href: "/invoices", label: "Invoices", icon: "📋" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/activity", label: "Activity", icon: "📜" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ compact }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              compact
                ? `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active ? "bg-[#003087] text-white" : "text-zinc-600 dark:text-zinc-400"
                  }`
                : `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#003087] text-white shadow-xs shadow-blue-950/20"
                      : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`
            }
          >
            <span className="text-sm">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
      {/* Synchronized Top Header Line (h-14 matches AppTopBar exactly) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#003087] text-xs font-black text-white shadow-xs">
            PP
          </span>
          <span>PayPilot</span>
        </Link>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
          Sandbox
        </span>
      </div>

      {/* Navigation & Footer */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <nav className="flex flex-col gap-1.5">
          <NavLinks />
        </nav>

        {/* Footer with Theme Switcher and Rail info */}
        <div className="space-y-2.5">
          <ThemeToggle />

          <div className="rounded-xl border border-zinc-200/90 bg-white/60 p-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                PayPal Rails Live
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Agent Toolkit & REST API
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppTopBar() {
  const pathname = usePathname();
  const title =
    pathname === "/"
      ? "AI Payment Assistant"
      : pathname.startsWith("/invoices")
        ? "Invoices & Receivables"
        : pathname.startsWith("/dashboard")
          ? "Financial Intelligence"
          : pathname.startsWith("/activity")
            ? "Activity & Audit History"
            : "PayPilot";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        <span className="hidden text-zinc-400 sm:inline">/</span>
        <span className="hidden items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-500 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span>HITL Protected</span>
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <ThemeToggle compact />
      </div>
    </header>
  );
}

export function AppMobileNav() {
  return (
    <div className="flex h-14 items-center justify-between border-b border-zinc-200 bg-zinc-100 px-4 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#003087] text-[10px] font-bold text-white">
          PP
        </span>
        <span className="text-xs font-bold tracking-tight">PayPilot</span>
      </div>
      <div className="flex items-center gap-1.5">
        <NavLinks compact />
        <ThemeToggle compact />
      </div>
    </div>
  );
}


