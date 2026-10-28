"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type ReminderListItem = {
  id: string;
  subject: string;
  note: string;
  sentAt: number;
  tone?: "friendly" | "firm" | "final";
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
  const [selectedTone, setSelectedTone] = useState<"friendly" | "firm" | "final">("firm");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Count reminders sent today in UTC
  const sentTodayCount = useMemo(() => {
    const now = new Date();
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return reminders.filter((r) => r.sentAt >= utcMidnight).length;
  }, [reminders]);

  async function send(): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone }),
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

  const toneDescriptions = {
    friendly: "Polite, collaborative check-in for recent overdue invoices.",
    firm: "Direct, professional payment notice highlighting the due date.",
    final: "Urgent final notice for significantly overdue accounts.",
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Automated Reminders
            </p>
            <span className="rounded-full border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {sentTodayCount}/2 UTC today
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            AI generates custom copy based on overdue days. PayPal emails the client directly.
          </p>
        </div>

        {canRemind ? (
          <button
            type="button"
            disabled={pending || sentTodayCount >= 2}
            onClick={() => void send()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-medium text-white shadow-md shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Generating & Sending…</span>
              </>
            ) : (
              <>
                <span>Send PayPal Reminder</span>
                <span>✉</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {canRemind ? (
        <div className="mt-5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 uppercase">Select Reminder Register</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {(
              [
                { id: "friendly", label: "Friendly Notice", icon: "🌱" },
                { id: "firm", label: "Firm Reminder", icon: "⚖️" },
                { id: "final", label: "Final Notice", icon: "⚠️" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTone(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedTone === t.id
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300/70 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {toneDescriptions[selectedTone]}
          </p>
        </div>
      ) : null}

      {disabledReason && !canRemind ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-400">
          ℹ️ {disabledReason}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs text-blue-400">
          ✓ {message}
        </div>
      ) : null}

      <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
        <p className="text-xs font-medium text-zinc-500 uppercase">Reminder History</p>
        {reminders.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {reminders.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.subject}
                  </p>
                  <span className="text-[11px] text-zinc-500">
                    {new Date(item.sentAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {item.note}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No reminders sent yet for this invoice.</p>
        )}
      </div>
    </section>
  );
}
