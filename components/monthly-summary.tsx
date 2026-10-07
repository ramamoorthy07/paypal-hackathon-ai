"use client";

import { useState } from "react";

export function MonthlySummary() {
  const [text, setText] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/summary/monthly", { method: "POST" });
      const body = (await response.json()) as {
        ok: boolean;
        error?: string;
        text?: string;
        monthLabel?: string;
      };
      if (!response.ok || !body.ok || !body.text?.trim()) {
        setError(body.error ?? `Summary failed (${response.status}).`);
        return;
      }
      setText(body.text);
      setMonth(body.monthLabel ?? null);
    } catch {
      setError("Could not reach the summary endpoint.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">AI briefing</p>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            {month ?? "This month"}
          </h2>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void generate()}
          className="inline-flex h-9 items-center rounded-full bg-zinc-950 px-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
        >
          {pending ? "Writing…" : text ? "Regenerate" : "Write summary"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {text ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Generates a short earnings briefing from local invoice totals. It does not contact PayPal.
        </p>
      )}
    </section>
  );
}
