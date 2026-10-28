"use client";

import { AlertTriangle, BarChart3, Users } from "lucide-react";
import { centsToAmountString } from "@/lib/core/money";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function ToolPending({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      {label}
    </div>
  );
}

export function CashForecastCard({
  output,
  state,
}: {
  output: unknown;
  state: string;
}) {
  if (state !== "output-available") {
    return <ToolPending label="Checking your next 6 weeks of expected cash…" />;
  }
  if (!isRecord(output) || !Array.isArray(output.weeks)) {
    return null;
  }

  const weeks = output.weeks as Array<{
    weekStart: string;
    expectedCents?: number;
    lowCents?: number;
    highCents?: number;
  }>;
  const totalExpected = weeks.reduce((sum, week) => sum + (week.expectedCents ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Cash forecast
          </p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            About ${centsToAmountString(totalExpected)} expected over 6 weeks
          </p>
        </div>
      </header>
      <div className="space-y-3 px-4 py-3">
        <ul className="grid gap-2 sm:grid-cols-2">
          {weeks.slice(0, 6).map((week) => (
            <li
              key={week.weekStart}
              className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <p className="text-[11px] text-zinc-500">Week of {week.weekStart}</p>
              <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                ${centsToAmountString(week.expectedCents ?? 0)}
              </p>
              <p className="text-[11px] text-zinc-500">
                Range ${centsToAmountString(week.lowCents ?? 0)}–
                {centsToAmountString(week.highCents ?? 0)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ClientRiskCard({
  output,
  state,
}: {
  output: unknown;
  state: string;
}) {
  if (state !== "output-available") {
    return <ToolPending label="Scoring client payment risk…" />;
  }
  if (!isRecord(output) || !Array.isArray(output.clients)) {
    return null;
  }

  const clients = output.clients as Array<{
    clientName: string;
    riskBand: string;
    riskScore: number;
    lateRate: number;
    openOverdueCents: number;
  }>;

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        No client risk rows yet — draft or send an invoice first.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Client risk
          </p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {clients.length} client{clients.length === 1 ? "" : "s"} scored
          </p>
        </div>
      </header>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {clients.slice(0, 5).map((client) => (
          <li key={client.clientName} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{client.clientName}</p>
              <p className="text-[11px] text-zinc-500">
                {Math.round(client.lateRate * 100)}% late · $
                {centsToAmountString(client.openOverdueCents)} overdue
              </p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {client.riskBand} · {client.riskScore}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverdueCard({
  output,
  state,
}: {
  output: unknown;
  state: string;
}) {
  if (state !== "output-available") {
    return <ToolPending label="Looking up overdue invoices…" />;
  }
  if (!isRecord(output) || !Array.isArray(output.invoices)) {
    return null;
  }

  const invoices = output.invoices as Array<{
    invoiceId: string;
    clientName: string;
    amountUsd: string;
    dueDate: string | null;
  }>;
  const totalCents = typeof output.totalCents === "number" ? output.totalCents : 0;
  const count = typeof output.count === "number" ? output.count : invoices.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Overdue invoices
          </p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {count === 0
              ? "Nothing overdue right now"
              : `${count} open · $${centsToAmountString(totalCents)} past due`}
          </p>
        </div>
      </header>
      {invoices.length > 0 ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {invoices.slice(0, 6).map((invoice) => (
            <li key={invoice.invoiceId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {invoice.clientName}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Due {invoice.dueDate ?? "—"}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                ${invoice.amountUsd}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          All sent invoices are still within their due dates.
        </p>
      )}
    </section>
  );
}
