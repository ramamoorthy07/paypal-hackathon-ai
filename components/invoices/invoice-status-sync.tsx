"use client";

import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DisplayStatus } from "@/lib/invoices/state";

export function InvoiceStatusSync({
  invoiceId,
  displayStatus,
}: {
  invoiceId: string;
  displayStatus: DisplayStatus;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shouldPoll = displayStatus === "SENT" || displayStatus === "OVERDUE";

  const sync = useCallback(async (): Promise<void> => {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/sync`, {
        method: "POST",
      });
      const body = (await response.json()) as { ok: boolean; error?: string; applied?: boolean };
      if (!response.ok || !body.ok) {
        setMessage(body.error ?? `Refresh failed (${response.status}).`);
        return;
      }
      if (body.applied) {
        setMessage("Status updated from PayPal.");
        router.refresh();
      }
    } catch {
      setMessage("Could not reach PayPal status refresh.");
    } finally {
      setPending(false);
    }
  }, [invoiceId, router]);

  const simulatePaidWebhook = async (): Promise<void> => {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          eventType: "INVOICING.INVOICE.PAID",
        }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setMessage(body.error ?? "Simulation failed.");
        return;
      }
      setMessage("Webhook verified: Invoice marked as PAID.");
      router.refresh();
    } catch {
      setMessage("Could not dispatch simulated webhook.");
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }
    let attempts = 0;
    const initialTimer = window.setTimeout(() => void sync(), 0);
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 6) {
        window.clearInterval(timer);
        return;
      }
      void sync();
    }, 15_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [shouldPoll, sync]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => void sync()}
        className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-800 shadow-xs transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {pending ? "Refreshing…" : "Sync Status"}
      </button>

      {displayStatus === "SENT" || displayStatus === "OVERDUE" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void simulatePaidWebhook()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3.5 text-xs font-semibold text-purple-600 shadow-xs transition hover:bg-purple-500/20 active:scale-95 disabled:opacity-60 dark:text-purple-300"
          title="Simulate incoming PayPal INVOICING.INVOICE.PAID webhook"
        >
          <Zap className="h-3.5 w-3.5" aria-hidden />
          <span>Simulate Paid Webhook</span>
        </button>
      ) : null}

      {message ? <p className="text-xs text-zinc-500">{message}</p> : null}
    </div>
  );
}
