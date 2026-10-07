import { AppHeader } from "@/components/app-header";
import { InvoiceOpenRefresh } from "@/components/invoice-open-refresh";
import { PaypalReconcileButton } from "@/components/paypal-reconcile-button";
import { StatusBadge } from "@/components/status-badge";
import { listInvoiceViews, type InvoiceView } from "@/lib/invoices/views";
import { centsToAmountString, isoDateFromMs } from "@/lib/money";
import type { DisplayStatus } from "@/lib/invoices/state";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ id: "ALL" | DisplayStatus; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "SENT", label: "Sent" },
  { id: "PAID", label: "Paid" },
  { id: "DRAFT", label: "Draft" },
  { id: "CANCELLED", label: "Cancelled" },
];

function isFilter(value: string | undefined): value is DisplayStatus {
  return (
    value === "DRAFT" ||
    value === "SENT" ||
    value === "PAID" ||
    value === "CANCELLED" ||
    value === "OVERDUE"
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const views = await listInvoiceViews();
  const filter = isFilter(status) ? status : "ALL";
  const visible = filter === "ALL" ? views : views.filter((row) => row.displayStatus === filter);
  const openIds = views
    .filter((row) => row.displayStatus === "SENT" || row.displayStatus === "OVERDUE")
    .map((row) => row.id);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="Invoices" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const href = item.id === "ALL" ? "/invoices" : `/invoices?status=${item.id}`;
              const active = filter === item.id;
              return (
                <a
                  key={item.id}
                  href={href}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PaypalReconcileButton />
            <InvoiceOpenRefresh ids={openIds} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-zinc-500" colSpan={4}>
                    No invoices in this view.
                  </td>
                </tr>
              ) : (
                visible.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          OVERDUE is derived from SENT invoices past their due date. Webhooks update PAID and
          CANCELLED. Sync from PayPal lists sandbox invoices and upserts by paypal_invoice_id;
          illegal status moves are ignored. Refresh asks PayPal for open rows when a webhook
          cannot reach this machine.
        </p>
      </main>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceView }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      <td className="px-4 py-3">
        <a className="font-medium text-zinc-950 underline dark:text-zinc-50" href={`/invoices/${invoice.id}`}>
          {invoice.clientName}
        </a>
        <p className="text-xs text-zinc-500">{invoice.clientEmail}</p>
      </td>
      <td className="px-4 py-3 tabular-nums">
        ${centsToAmountString(invoice.amountCents)} {invoice.currency}
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
        {invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={invoice.displayStatus} />
      </td>
    </tr>
  );
}
