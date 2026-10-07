const NAV = [
  { href: "/", label: "Chat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/unlock", label: "Unlock" },
  { href: "/api/health", label: "Health" },
] as const;

export function AppHeader({ title, wide }: { title: string; wide?: boolean }) {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={`mx-auto flex w-full items-baseline justify-between gap-4 ${wide ? "max-w-6xl" : "max-w-5xl"}`}
      >
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">PayPilot</p>
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h1>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-zinc-500">
          {NAV.map((item) => (
            <a key={item.href} className="underline" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
