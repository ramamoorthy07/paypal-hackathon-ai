"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { AuditLogRow } from "@/lib/db/schema";
import { isoDateFromMs } from "@/lib/core/money";

function formatAction(action: string): string {
  switch (action) {
    case "propose_invoice":
      return "Draft Invoice Proposed";
    case "confirm_invoice":
      return "Invoice Confirmed & Dispatched";
    case "remind_invoice":
      return "Overdue Reminder Sent";
    case "sync_paypal_status":
      return "PayPal Status Synced";
    case "reconcile_paypal":
      return "Ledger Reconciled from PayPal";
    case "webhook_received":
      return "PayPal Webhook Processed";
    case "simulate_webhook":
      return "PayPal Webhook Simulated";
    default:
      return action.replace(/_/g, " ");
  }
}

function actorBadge(actor: string) {
  switch (actor) {
    case "agent":
      return "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400";
    case "user":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400";
    case "webhook":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400";
    case "simulator":
      return "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-400";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  }
}

function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function ActivityTable({ logs }: { logs: AuditLogRow[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        (log.invoiceId && log.invoiceId.toLowerCase().includes(q)) ||
        log.payload.toLowerCase().includes(q),
    );
  }, [logs, search]);

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
      {/* Search and Rows per page */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search events, clients, IDs..."
            className="h-8 w-60 rounded-lg border border-zinc-200 bg-white pl-8 pr-7 text-xs outline-none transition focus:w-72 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
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
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Invoice Reference</th>
                <th className="px-5 py-3.5">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {paginated.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-zinc-500" colSpan={5}>
                    {search ? "No events match your search query." : "No activity logs recorded yet."}
                  </td>
                </tr>
              ) : (
                paginated.map((entry) => {
                  const details = parsePayload(entry.payload);
                  return (
                    <tr
                      key={entry.id}
                      className="transition hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {isoDateFromMs(entry.timestamp)}
                          </span>
                          <span className="text-[10px] text-zinc-500 tabular-nums">
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Actor Badge */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            entry.actor === "simulator"
                              ? "uppercase font-bold tracking-wider"
                              : "capitalize"
                          } ${actorBadge(entry.actor)}`}
                        >
                          {entry.actor === "simulator" ? "SIMULATED" : entry.actor}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {formatAction(entry.action)}
                      </td>

                      {/* Invoice ID */}
                      <td className="px-4 py-3.5">
                        {entry.invoiceId ? (
                          <Link
                            href={`/invoices/${entry.invoiceId}`}
                            className="font-mono text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {entry.invoiceId.length > 18
                              ? `${entry.invoiceId.slice(0, 14)}…`
                              : entry.invoiceId}
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Payload preview */}
                      <td className="px-5 py-3.5 text-xs text-zinc-600 dark:text-zinc-400">
                        {details ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {details.clientEmail ? (
                              <span>
                                Client:{" "}
                                <strong className="text-zinc-700 dark:text-zinc-300">
                                  {String(details.clientEmail)}
                                </strong>
                              </span>
                            ) : null}
                            {details.amountCents ? (
                              <span>
                                Amount:{" "}
                                <strong className="text-zinc-700 dark:text-zinc-300">
                                  ${(Number(details.amountCents) / 100).toFixed(2)}
                                </strong>
                              </span>
                            ) : null}
                            {details.paypalInvoiceId ? (
                              <span>
                                PayPal ID:{" "}
                                <strong className="font-mono text-blue-500">
                                  {String(details.paypalInvoiceId)}
                                </strong>
                              </span>
                            ) : null}
                            {details.tone ? (
                              <span>
                                Tone:{" "}
                                <strong className="capitalize text-amber-500">
                                  {String(details.tone)}
                                </strong>
                              </span>
                            ) : null}
                            {details.sendVia ? (
                              <span>
                                Rail:{" "}
                                <strong className="text-zinc-700 dark:text-zinc-300">
                                  {String(details.sendVia)}
                                </strong>
                              </span>
                            ) : null}
                            {details.from && details.to ? (
                              <span>
                                Status:{" "}
                                <strong className="text-emerald-500">
                                  {String(details.from)} → {String(details.to)}
                                </strong>
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-zinc-500">
                            {entry.payload}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
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
