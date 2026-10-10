import Link from "next/link";
import { InvoiceOpenRefresh } from "@/components/invoice-open-refresh";
import { InvoicesTable } from "@/components/invoices-table";
import { PaypalReconcileButton } from "@/components/paypal-reconcile-button";
import { listInvoiceViews } from "@/lib/invoices/views";
import { centsToAmountString } from "@/lib/money";
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

  // Compute metrics ribbon from all views
  const nonCancelled = views.filter((r) => r.displayStatus !== "CANCELLED");
  const totalBilledCents = nonCancelled.reduce((sum, r) => sum + r.amountCents, 0);

  const paidRows = views.filter((r) => r.displayStatus === "PAID");
  const paidCents = paidRows.reduce((sum, r) => sum + r.amountCents, 0);

  const overdueRows = views.filter((r) => r.displayStatus === "OVERDUE");
  const overdueCents = overdueRows.reduce((sum, r) => sum + r.amountCents, 0);

  const sentRows = views.filter((r) => r.displayStatus === "SENT");
  const outstandingCents = overdueCents + sentRows.reduce((sum, r) => sum + r.amountCents, 0);

  const draftRows = views.filter((r) => r.displayStatus === "DRAFT");
  const draftCents = draftRows.reduce((sum, r) => sum + r.amountCents, 0);

  const filterCounts: Record<string, number> = {
    ALL: views.length,
    OVERDUE: overdueRows.length,
    SENT: sentRows.length,
    PAID: paidRows.length,
    DRAFT: draftRows.length,
    CANCELLED: views.filter((r) => r.displayStatus === "CANCELLED").length,
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Invoices & Receivables
            </h1>
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-500">
              PayPal Rails
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Lifecycle tracking of proposals, PayPal sandbox sync, payment links, and AR collections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-500 active:scale-95"
          >
            <span>+</span>
            <span>Draft Invoice in Chat</span>
          </Link>
          <PaypalReconcileButton />
          <InvoiceOpenRefresh ids={openIds} />
        </div>
      </div>

      {/* Top 4 Financial Metric Summary Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Total Invoiced
            </span>
            <span className="text-base">💳</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            ${centsToAmountString(totalBilledCents)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {nonCancelled.length} active invoices across all clients
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-white p-4 shadow-xs transition hover:shadow-md dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Collected (Settled)
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              {totalBilledCents > 0
                ? `${Math.round((paidCents / totalBilledCents) * 100)}% settled`
                : "0%"}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
            ${centsToAmountString(paidCents)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {paidRows.length} invoice{paidRows.length === 1 ? "" : "s"} fully paid via PayPal
          </p>
        </div>

        <div
          className={`rounded-2xl border bg-white p-4 shadow-xs transition hover:shadow-md dark:bg-zinc-950 ${
            overdueRows.length > 0 ? "border-rose-500/30" : "border-blue-500/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Outstanding Receivables
            </span>
            {overdueRows.length > 0 ? (
              <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                {overdueRows.length} overdue
              </span>
            ) : (
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                On track
              </span>
            )}
          </div>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${
              overdueRows.length > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-950 dark:text-zinc-50"
            }`}
          >
            ${centsToAmountString(outstandingCents)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            ${centsToAmountString(overdueCents)} past due date · {sentRows.length} pending
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Drafts (Unsent)
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
              Local
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            ${centsToAmountString(draftCents)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {draftRows.length} draft{draftRows.length === 1 ? "" : "s"} awaiting confirmation
          </p>
        </div>
      </div>

      {/* Filter Tabs & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => {
            const href = item.id === "ALL" ? "/invoices" : `/invoices?status=${item.id}`;
            const active = filter === item.id;
            const count = filterCounts[item.id] ?? 0;
            return (
              <Link
                key={item.id}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-950 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-950"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold ${
                    active
                      ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">
          Showing {visible.length} of {views.length} total entries
        </p>
      </div>

      {/* Paginated Table with Frozen Header and Search */}
      <InvoicesTable invoices={visible} />
    </div>
  );
}

