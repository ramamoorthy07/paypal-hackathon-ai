"use client";

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

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }
    let attempts = 0;
    void sync();
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 6) {
        window.clearInterval(timer);
        return;
      }
      void sync();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [shouldPoll, sync]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void sync()}
        className="inline-flex h-10 items-center rounded-full border border-zinc-200 px-4 text-sm font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100"
      >
        {pending ? "Refreshing…" : "Refresh PayPal status"}
      </button>
      {message ? <p className="text-sm text-zinc-500">{message}</p> : null}
    </div>
  );
}
