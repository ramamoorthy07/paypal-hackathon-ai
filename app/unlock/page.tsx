import { getDemoAccessCode } from "@/lib/access/demo-code";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;
  const configured = Boolean(getDemoAccessCode());

  let errorMessage: string | null = null;
  if (error === "rate_limit") {
    errorMessage = "Too many unlock attempts. Please wait a few minutes.";
  } else if (error === "unset") {
    errorMessage = "DEMO_ACCESS_CODE is not set in environment. Access is unrestricted in dev.";
  } else if (error === "invalid") {
    errorMessage = "Incorrect access code. Please try again.";
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-2 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Unlock PayPilot Demo
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {configured
              ? "Enter your demo access code to access invoices, chat, and live insights."
              : "Demo access gate is off (DEMO_ACCESS_CODE is unset in this environment)."}
          </p>
        </div>

        <form method="post" action="/api/unlock" className="space-y-4">
          {from ? <input type="hidden" name="from" value={from} /> : null}
          <div className="space-y-1.5">
            <label
              htmlFor="code"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Demo Access Code
            </label>
            <input
              id="code"
              name="code"
              type="password"
              autoComplete="off"
              required
              placeholder="Enter access code..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Unlock Demo
          </button>
        </form>
      </div>
    </div>
  );
}

