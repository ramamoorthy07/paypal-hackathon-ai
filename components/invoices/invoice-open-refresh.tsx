"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceOpenRefresh({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (ids.length === 0) {
    return null;
  }

  async function refreshOpen(): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      let applied = 0;
      for (const id of ids) {
        const response = await fetch(`/api/invoices/${encodeURIComponent(id)}/sync`, {
          method: "POST",
        });
        const body = (await response.json()) as { ok?: boolean; applied?: boolean };
        if (response.ok && body.applied) {
          applied += 1;
        }
      }
      setMessage(applied > 0 ? `Updated ${applied} invoice${applied === 1 ? "" : "s"}.` : "No status changes.");
      router.refresh();
    } catch {
      setMessage("Refresh failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void refreshOpen()}
        className="inline-flex h-9 items-center rounded-full border border-zinc-200 px-3 text-sm text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100"
      >
        {pending ? "Refreshing…" : "Refresh open invoices"}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}
