"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { InvoiceView } from "@/lib/invoices/views";
import { centsToAmountString, isoDateFromMs } from "@/lib/core/money";

export function InvoicesTable({ invoices }: { invoices: InvoiceView[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        (inv.paypalInvoiceId && inv.paypalInvoiceId.toLowerCase().includes(q)),
    );
  }, [invoices, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const startIndex = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filtered.length);

  return (
    <div className="space-y-3">
      {/* Search and Page Size Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-xs text-zinc-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search invoices by client or ID..."
            className="h-8 w-60 rounded-lg border border-zinc-200 bg-white pl-8 pr-7 text-xs outline-none transition focus:w-72 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Rows per page"
            className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 outline-none transition dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container with Sticky Frozen Header */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <div className="max-h-[560px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
              <tr>
                <th className="px-5 py-3.5">Client & Details</th>
                <th className="px-4 py-3.5">PayPal Reference</th>
                <th className="px-4 py-3.5">Line Items</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Schedule</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {paginated.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-zinc-500" colSpan={7}>
                    {search ? (
                      <p className="text-xs">No invoices match search &ldquo;{search}&rdquo;.</p>
                    ) : (
                      <p className="text-xs">No invoices in this view.</p>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((invoice) => (
                  <InvoiceTableRow key={invoice.id} invoice={invoice} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <div>
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{startIndex}</span>{" "}
            to <span className="font-semibold text-zinc-800 dark:text-zinc-200">{endIndex}</span> of{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{filtered.length}</span>{" "}
            entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Previous
            </button>

            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceTableRow({ invoice }: { invoice: InvoiceView }) {
  const isOverdue = invoice.displayStatus === "OVERDUE";
  const firstItem = invoice.lineItems[0];
  const itemsCount = invoice.lineItems.length;

  return (
    <tr className="transition hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
      {/* Client column */}
      <td className="px-5 py-4">
        <div className="flex flex-col">
          <Link
            className="font-semibold text-zinc-950 hover:underline dark:text-zinc-100"
            href={`/invoices/${invoice.id}`}
          >
            {invoice.clientName}
          </Link>
          <span className="text-xs text-zinc-500">{invoice.clientEmail}</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {invoice.id}
            </span>
            <span className="text-[10px] text-zinc-400 capitalize">· {invoice.createdBy}</span>
          </div>
        </div>
      </td>

      {/* PayPal Reference */}
      <td className="px-4 py-4">
        {invoice.paypalInvoiceId ? (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
              {invoice.paypalInvoiceId}
            </span>
            {invoice.hostedUrl ? (
              <a
                href={invoice.hostedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 hover:underline dark:hover:text-zinc-200"
              >
                <span>Hosted Link</span>
                <span className="text-[9px]">↗</span>
              </a>
            ) : null}
          </div>
        ) : (
          <span className="text-xs italic text-zinc-400">Local draft (unsent)</span>
        )}
      </td>

      {/* Line Items preview */}
      <td className="px-4 py-4">
        {firstItem ? (
          <div className="flex flex-col">
            <span className="text-xs text-zinc-800 dark:text-zinc-200">
              {firstItem.name}
            </span>
            <span className="text-[11px] text-zinc-400">
              {itemsCount > 1
                ? `+${itemsCount - 1} more item${itemsCount > 2 ? "s" : ""}`
                : `${firstItem.quantity} unit${firstItem.quantity > 1 ? "s" : ""}`}
            </span>
          </div>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        )}
      </td>

      {/* Amount & FX */}
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            ${centsToAmountString(invoice.amountCents)}{" "}
            <span className="text-xs font-normal text-zinc-400">{invoice.currency}</span>
          </span>
          {invoice.originalCurrency === "INR" && invoice.originalAmountCents ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              From ₹{centsToAmountString(invoice.originalAmountCents)} @ {invoice.fxRate}
            </span>
          ) : null}
        </div>
      </td>

      {/* Schedule */}
      <td className="px-4 py-4">
        <div className="flex flex-col text-xs">
          <span className="text-zinc-500">
            Due:{" "}
            <span
              className={
                isOverdue
                  ? "font-semibold text-rose-600 dark:text-rose-400"
                  : "text-zinc-700 dark:text-zinc-300"
              }
            >
              {invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "—"}
            </span>
          </span>
          {invoice.paidAt != null ? (
            <span className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              Paid: {isoDateFromMs(invoice.paidAt)}
            </span>
          ) : invoice.issuedAt != null ? (
            <span className="mt-0.5 text-[11px] text-zinc-400">
              Issued: {isoDateFromMs(invoice.issuedAt)}
            </span>
          ) : null}
        </div>
      </td>

      {/* Status Badge */}
      <td className="px-4 py-4">
        <StatusBadge status={invoice.displayStatus} />
      </td>

      {/* Action */}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {invoice.hostedUrl ? (
            <a
              href={invoice.hostedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="Open buyer checkout in PayPal Sandbox"
            >
              Pay
            </a>
          ) : null}
          <Link
            href={`/invoices/${invoice.id}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <span>Details</span>
            <span>→</span>
          </Link>
        </div>
      </td>
    </tr>
  );
}
