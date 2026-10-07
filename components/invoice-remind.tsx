"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ReminderListItem = {
  id: string;
  subject: string;
  note: string;
  sentAt: number;
};

export function InvoiceRemind({
  invoiceId,
  canRemind,
  disabledReason,
  reminders,
}: {
  invoiceId: string;
  canRemind: boolean;
  disabledReason: string | null;
  reminders: ReminderListItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/remind`, {
        method: "POST",
      });
      const body = (await response.json()) as { ok: boolean; error?: string; subject?: string };
      if (!response.ok || !body.ok) {
        setMessage(body.error ?? `Reminder failed (${response.status}).`);
        return;
      }
      setMessage(body.subject ? `Sent: ${body.subject}` : "PayPal reminder sent.");
      router.refresh();
    } catch {
      setMessage("Could not reach the reminder endpoint.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Reminders</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            AI writes the note. PayPal emails it. Two per UTC day.
          </p>
        </div>
        <button
          type="button"
          disabled={!canRemind || pending}
          onClick={() => void send()}
          className="inline-flex h-10 items-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
        >
          {pending ? "Sending…" : "Send PayPal reminder"}
        </button>
      </div>
      {disabledReason && !canRemind ? (
        <p className="mt-3 text-sm text-zinc-500">{disabledReason}</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
      {reminders.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {reminders.map((item) => (
            <li key={item.id} className="py-3">
              <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{item.subject}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.note}</p>
              <p className="mt-1 text-xs text-zinc-500">{new Date(item.sentAt).toISOString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">No reminders sent yet.</p>
      )}
    </section>
  );
}
