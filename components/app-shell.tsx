"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Chat" },
  { href: "/invoices", label: "Invoices" },
  { href: "/dashboard", label: "Dashboard" },
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
                ? `rounded-md px-2 py-1 text-sm ${active ? "bg-[#003087] text-white" : "text-zinc-600"}`
                : `rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-[#003087] text-white"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`
            }
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100 px-3 py-5 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
      <div className="px-3 pb-5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          PayPilot
        </Link>
        <p className="mt-1 text-[11px] leading-4 text-zinc-500">PayPal waits until Confirm.</p>
      </div>
      <nav className="flex flex-col gap-1">
        <NavLinks />
        <Link
          href="/unlock"
          className={`rounded-lg px-3 py-2 text-sm ${
            isActive(pathname, "/unlock")
              ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          }`}
        >
          Unlock
        </Link>
      </nav>
    </aside>
  );
}

export function AppMobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-100 px-3 py-2 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mr-2 text-xs font-semibold tracking-wide uppercase">PayPilot</p>
      <NavLinks compact />
      <Link
        href="/unlock"
        className={`ml-auto rounded-md px-2 py-1 text-xs ${
          isActive(pathname, "/unlock") ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400"
        }`}
      >
        Unlock
      </Link>
    </div>
  );
}
