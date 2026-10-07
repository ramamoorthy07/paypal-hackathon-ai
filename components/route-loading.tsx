export function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-10">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
        <p className="text-sm leading-6 text-zinc-500">
          Render&apos;s free instance sleeps when idle. The first request can take up to a minute.
        </p>
        <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
