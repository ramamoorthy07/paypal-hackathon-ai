export function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-10">
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
      <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
