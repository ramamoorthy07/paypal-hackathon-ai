import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "unset"
      ? "DEMO_ACCESS_CODE is not set. Locally the gate is off; set the env var to enable it."
      : error
        ? "That access code did not match."
        : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="Unlock demo" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Chat, confirm, and PayPal reminders are gated so a public demo cannot burn Azure credits
          or spam sandbox invoices. Enter the demo access code to continue.
        </p>
        <form
          method="post"
          action="/api/unlock"
          className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100" htmlFor="code">
            Access code
          </label>
          <input
            id="code"
            name="code"
            type="password"
            autoComplete="off"
            required
            className="h-11 rounded-xl border border-zinc-200 bg-transparent px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            Unlock
          </button>
          {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
        </form>
      </main>
    </div>
  );
}
