export function AppHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">PayPilot</p>
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm text-zinc-500">
          <a className="underline" href="/">
            Chat
          </a>
          <a className="underline" href="/invoices">
            Invoices
          </a>
          <a className="underline" href="/api/health">
            Health
          </a>
        </nav>
      </div>
    </header>
  );
}
