import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceQr } from "@/components/invoice-qr";
import { InvoiceRemind } from "@/components/invoice-remind";
import { InvoiceStatusSync } from "@/components/invoice-status-sync";
import { StatusBadge } from "@/components/status-badge";
import { listRemindersForInvoice } from "@/lib/db/repositories/reminders";
import { getInvoiceView } from "@/lib/invoices/views";
import { centsToAmountString, isoDateFromMs } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceView(id);
  if (!invoice) {
    notFound();
  }
  const reminders = await listRemindersForInvoice(id);
  const canRemind = invoice.displayStatus === "OVERDUE" && Boolean(invoice.paypalInvoiceId);
  const remindDisabledReason = canRemind
    ? null
    : invoice.displayStatus !== "OVERDUE"
      ? "Reminders are only sent after the due date (local OVERDUE)."
      : "Local overdue invoice — PayPal is not contacted until this invoice is confirmed and sent.";

  const inr =
    invoice.originalCurrency === "INR" && invoice.originalAmountCents != null
      ? {
          amount: centsToAmountString(invoice.originalAmountCents),
          rate: invoice.fxRate,
        }
      : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col gap-3 border-b border-zinc-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800/80">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span>←</span>
            <span>Back to Invoices</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">/</span>
            <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {invoice.id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.displayStatus} />
          {invoice.hostedUrl ? (
            <a
              href={invoice.hostedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-500"
            >
              <span>Pay on PayPal</span>
              <span className="text-[10px]">↗</span>
            </a>
          ) : null}
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Official Invoice Document */}
        <section className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {/* Invoice Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800/80">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Invoice Statement
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {invoice.clientName}
                </h2>
                <p className="text-xs text-zinc-500">{invoice.clientEmail}</p>
              </div>

              <div className="text-right">
                <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {invoice.paypalInvoiceId ?? invoice.id}
                </span>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Created via <span className="capitalize">{invoice.createdBy}</span>
                </p>
              </div>
            </div>

            {/* Amount Banner */}
            <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/40">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                Total Due
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-3xl font-extrabold tracking-tight tabular-nums text-zinc-950 sm:text-4xl dark:text-zinc-50">
                  ${centsToAmountString(invoice.amountCents)}
                </p>
                <span className="text-sm font-semibold text-zinc-500">{invoice.currency}</span>
              </div>

              {inr ? (
                <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">Cross-Border FX Conversion:</span> Converted from ₹{inr.amount} INR at labeled demo rate {inr.rate} USD/INR (Frankfurter ECB reference rate).
                </div>
              ) : null}
            </div>

            {/* Schedule & Metadata Grid */}
            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-zinc-100 bg-zinc-50/30 p-4 text-xs dark:border-zinc-800/50 dark:bg-zinc-900/20 sm:grid-cols-4">
              <div>
                <dt className="font-medium text-zinc-400 uppercase">Due Date</dt>
                <dd className="mt-1 font-semibold text-zinc-800 dark:text-zinc-200">
                  {invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-400 uppercase">Issued Date</dt>
                <dd className="mt-1 font-semibold text-zinc-800 dark:text-zinc-200">
                  {invoice.issuedAt != null ? isoDateFromMs(invoice.issuedAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-400 uppercase">Paid Date</dt>
                <dd className="mt-1 font-semibold text-zinc-800 dark:text-zinc-200">
                  {invoice.paidAt != null ? isoDateFromMs(invoice.paidAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-400 uppercase">PayPal Status</dt>
                <dd className="mt-1 break-all font-mono font-medium text-zinc-800 dark:text-zinc-200">
                  {invoice.status}
                </dd>
              </div>
            </dl>

            {/* Line Items Table */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Line Items Breakdown
              </h3>
              <div className="mt-2 max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 text-[11px] font-semibold text-zinc-500 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
                    <tr>
                      <th className="px-4 py-2.5">Item Description</th>
                      <th className="px-3 py-2.5 text-center">Qty</th>
                      <th className="px-3 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {invoice.lineItems.map((item, idx) => (
                      <tr key={`${item.name}-${idx}`} className="dark:hover:bg-zinc-900/30">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-zinc-600 dark:text-zinc-400">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                          ${centsToAmountString(item.unitAmountCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          ${centsToAmountString(item.quantity * item.unitAmountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-zinc-200 bg-zinc-50/60 font-semibold dark:border-zinc-800 dark:bg-zinc-900/30">
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 text-right text-zinc-500">
                        Subtotal & Total USD:
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-950 dark:text-zinc-50">
                        ${centsToAmountString(invoice.amountCents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Note & Payment Terms */}
            {invoice.note ? (
              <div className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-900/30">
                <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Note to Recipient
                </p>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{invoice.note}</p>
              </div>
            ) : null}

            {/* Direct Hosted Link Banner */}
            {invoice.hostedUrl ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:border-blue-500/20 dark:bg-blue-950/20">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    PayPal Hosted Payer Checkout
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Shareable buyer checkout url generated by the PayPal Invoicing API.
                  </p>
                </div>
                <a
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-500"
                  href={invoice.hostedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Launch Checkout</span>
                  <span className="text-[10px]">↗</span>
                </a>
              </div>
            ) : null}
          </div>
        </section>

        {/* Right Column (5 cols): Operations, Rail Sync, Mobile QR, AR Reminders */}
        <div className="space-y-6 lg:col-span-5">
          {/* Card 1: PayPal Status & Rail Sync */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                PayPal Sandbox Rail
              </h3>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <div className="mt-3">
              {invoice.paypalInvoiceId ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="text-zinc-500">PayPal Invoice ID:</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      {invoice.paypalInvoiceId}
                    </span>
                  </div>
                  <InvoiceStatusSync invoiceId={invoice.id} displayStatus={invoice.displayStatus} />
                  <p className="text-[11px] text-zinc-500">
                    Auto-polls every 15s when SENT or OVERDUE, or sync instantly on webhook events.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  Local draft only. Confirm in Chat to dispatch this invoice directly to the PayPal sandbox.
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Mobile QR Code */}
          {invoice.paypalInvoiceId && invoice.status !== "DRAFT" ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  Mobile QR Checkout
                </h3>
                <span className="text-[11px] text-zinc-400">Scan to Test</span>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Scan with a mobile camera to test the buyer checkout experience on iOS or Android.
              </p>
              <div className="flex justify-center">
                <InvoiceQr invoiceId={invoice.id} />
              </div>
            </section>
          ) : null}

          {/* Card 3: AR Collection & Reminders */}
          <InvoiceRemind
            invoiceId={invoice.id}
            canRemind={canRemind}
            disabledReason={remindDisabledReason}
            reminders={reminders}
          />
        </div>
      </div>
    </div>
  );
}

