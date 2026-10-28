"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PaypalReconcileButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync(): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/invoices/reconcile", { method: "POST" });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        updated?: number;
        inserted?: number;
        skipped?: number;
        errors?: number;
      };
      if (!response.ok || !body.ok) {
        setMessage(body.error ?? `Sync failed (${response.status}).`);
        return;
      }
      setMessage(
        `PayPal sync: ${body.updated ?? 0} updated, ${body.inserted ?? 0} imported, ${body.skipped ?? 0} unchanged${
          body.errors ? `, ${body.errors} errors` : ""
        }.`,
      );
      router.refresh();
    } catch {
      setMessage("PayPal sync failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void sync()}
        className="inline-flex h-9 items-center rounded-full border border-zinc-200 px-3 text-sm text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100"
      >
        {pending ? "Syncing…" : "Sync from PayPal"}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}
