export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          PayPilot
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          AI freelancer payment agent
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Chat, confirmation, and invoices land in later steps. For now, confirm
          sandbox credentials with the health endpoint.
        </p>
        <a
          className="mt-6 inline-flex h-11 items-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
          href="/api/health"
        >
          Open /api/health
        </a>
      </main>
    </div>
  );
}
