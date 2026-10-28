"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { centsToAmountString } from "@/lib/core/money";

export type SimulatorInvoiceOption = {
  id: string;
  clientName: string;
  amountCents: number;
  currency: string;
  status: string;
  displayStatus: string;
  paypalInvoiceId: string | null;
};

export function WebhookSimulator({
  invoices,
}: {
  invoices: SimulatorInvoiceOption[];
}) {
  const router = useRouter();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    invoices.find((i) => i.displayStatus === "SENT" || i.displayStatus === "OVERDUE")?.id ??
      invoices[0]?.id ??
      "",
  );
  const [selectedEventType, setSelectedEventType] = useState<string>("INVOICING.INVOICE.PAID");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  async function triggerSimulation(eventTypeOverride?: string): Promise<void> {
    const eventType = eventTypeOverride ?? selectedEventType;
    if (!selectedInvoiceId) {
      setMessage({ text: "Please select an invoice first.", type: "error" });
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          eventType,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        webhookId?: string;
        eventPayload?: Record<string, unknown>;
        result?: { applied?: boolean; duplicate?: boolean; reason?: string };
      };

      if (!response.ok || !data.ok) {
        setMessage({
          text: data.error ?? `Webhook simulation failed (${response.status})`,
          type: "error",
        });
        return;
      }

      setLastPayload(data.eventPayload ?? null);

      const statusName =
        eventType === "INVOICING.INVOICE.PAID"
          ? "PAID"
          : eventType === "INVOICING.INVOICE.CANCELLED"
            ? "CANCELLED"
            : "REFUNDED";

      setMessage({
        text: `✓ PayPal Webhook received: ${eventType} applied to ${
          selectedInvoice?.clientName ?? selectedInvoiceId
        }. Status updated to ${statusName}.`,
        type: "success",
      });

      router.refresh();
    } catch {
      setMessage({ text: "Could not reach webhook simulation endpoint.", type: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10 p-5 shadow-sm dark:border-purple-500/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <p className="text-xs font-semibold tracking-wider text-purple-600 uppercase dark:text-purple-400">
              Live PayPal Webhook Simulator
            </p>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-300">
              Judges Demo Tool
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Simulate asynchronous PayPal Sandbox notifications (e.g., buyer settles payment or
            cancels). Watch real-time ledger transition and immutable audit logs.
          </p>
        </div>

        {lastPayload ? (
          <button
            type="button"
            onClick={() => setShowPayload(!showPayload)}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-purple-500/30 bg-white/80 px-2.5 py-1 text-xs font-medium text-purple-700 shadow-xs transition hover:bg-purple-50 dark:border-purple-500/40 dark:bg-zinc-900 dark:text-purple-300 dark:hover:bg-zinc-800"
          >
            <span>{showPayload ? "Hide" : "Inspect"} Webhook JSON</span>
            <span className="text-[10px]">{showPayload ? "▲" : "▼"}</span>
          </button>
        ) : null}
      </div>

      {/* Simulator Control Bar */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
        {/* Invoice Selector (6 cols) */}
        <div className="sm:col-span-6">
          <label className="text-[11px] font-medium text-zinc-500 uppercase">
            Target Invoice
          </label>
          <select
            value={selectedInvoiceId}
            onChange={(e) => setSelectedInvoiceId(e.target.value)}
            disabled={pending || invoices.length === 0}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 shadow-xs transition focus:border-purple-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.clientName} — ${centsToAmountString(inv.amountCents)} {inv.currency} [
                {inv.displayStatus}]
              </option>
            ))}
          </select>
        </div>

        {/* Event Type Selector (3 cols) */}
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-zinc-500 uppercase">
            PayPal Event Type
          </label>
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            disabled={pending}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 shadow-xs transition focus:border-purple-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="INVOICING.INVOICE.PAID">INVOICE.PAID (Buyer Settled)</option>
            <option value="INVOICING.INVOICE.CANCELLED">INVOICE.CANCELLED</option>
            <option value="INVOICING.INVOICE.REFUNDED">INVOICE.REFUNDED</option>
          </select>
        </div>

        {/* Trigger Button (3 cols) */}
        <div className="sm:col-span-3 sm:pt-4">
          <button
            type="button"
            disabled={pending || !selectedInvoiceId}
            onClick={() => void triggerSimulation()}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white shadow-sm shadow-purple-600/30 transition hover:bg-purple-500 active:scale-95 disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Simulating…</span>
              </>
            ) : (
              <>
                <span>Dispatch Webhook</span>
                <span>⚡</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-purple-500/10">
        <span className="text-[11px] font-medium text-zinc-500">Quick simulation presets:</span>
        <button
          type="button"
          disabled={pending || !selectedInvoiceId}
          onClick={() => void triggerSimulation("INVOICING.INVOICE.PAID")}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
        >
          <span>✓ Mark Paid (Customer Checkout)</span>
        </button>
        <button
          type="button"
          disabled={pending || !selectedInvoiceId}
          onClick={() => void triggerSimulation("INVOICING.INVOICE.CANCELLED")}
          className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
        >
          <span>✕ Mark Cancelled</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {message ? (
        <div
          className={`mt-3.5 rounded-xl border p-3 text-xs ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* Expandable JSON Inspector */}
      {showPayload && lastPayload ? (
        <div className="mt-3.5 rounded-xl border border-zinc-200 bg-zinc-900 p-3.5 text-zinc-100 shadow-inner dark:border-zinc-800">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-[11px] font-mono font-medium text-zinc-400">
              Payload: {String(lastPayload.event_type)}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              ID: {String(lastPayload.id)}
            </span>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto font-mono text-[11px] leading-relaxed text-emerald-400">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
