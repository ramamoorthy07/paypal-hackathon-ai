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
                : `rounded-lg px-2.5 py-2 text-sm ${
                    active
                      ? "bg-[#003087] text-white"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
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

function UnlockLink({ compact }: { compact?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, "/unlock");

  return (
    <Link
      href="/unlock"
      className={
        compact
          ? `ml-auto rounded-md px-2 py-1 text-xs ${active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400"}`
          : `mt-2 rounded-lg px-2.5 py-2 text-xs ${
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`
      }
    >
      Unlock
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-5 dark:border-zinc-800 dark:bg-zinc-950 md:flex">
      <Link href="/" className="px-2 pb-6 text-sm font-semibold tracking-tight">
        PayPilot
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        <NavLinks />
      </nav>
      <p className="px-2 pt-4 text-[11px] leading-4 text-zinc-400">
        Sandbox. PayPal waits until you Confirm.
      </p>
      <UnlockLink />
    </aside>
  );
}

export function AppMobileNav() {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-3 py-2 md:hidden dark:border-zinc-800 dark:bg-zinc-950">
      <p className="mr-2 text-xs font-semibold tracking-wide uppercase">PayPilot</p>
      <NavLinks compact />
      <UnlockLink compact />
    </div>
  );
}
