import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Clock3,
  FilePenLine,
  Plus,
} from "lucide-react";
import { CashForecastChart } from "@/components/dashboard/cash-forecast-chart";
import { ClientRiskGrid } from "@/components/dashboard/client-risk-grid";
import { EarningsGrid } from "@/components/dashboard/earnings-grid";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthlySummary } from "@/components/dashboard/monthly-summary";
import { earningsSnapshot, toEarningsRow } from "@/lib/invoices/earnings";
import { insightsSnapshot } from "@/lib/insights/queries";
import { centsToAmountString } from "@/lib/core/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { invoices, behaviors, forecast } = await insightsSnapshot(now);
  const snapshot = earningsSnapshot(invoices, now);
  const byClient = new Map(behaviors.map((row) => [row.clientId, row]));
  const rows = invoices.map((invoice) => toEarningsRow(invoice, byClient.get(invoice.clientId)));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Financial Intelligence & Cash Flow
            </h1>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              Live Ledger
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Real-time ledger analytics, deterministic behavioral risk scoring, and predictive 6-week cash runway.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span>Draft Invoice in Chat</span>
          </Link>
          <Link
            href="/invoices"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span>Invoices Ledger</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            No invoices in the ledger yet.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Head to the Chat Assistant to draft your first invoice proposal with natural language.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Open Chat Assistant
          </Link>
        </div>
      ) : null}

      {/* Top 4 KPI Metrics Ribbon */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Paid this month"
          value={`$${centsToAmountString(snapshot.paidThisMonthCents)}`}
          hint={`${snapshot.paidThisMonthCount} invoice${snapshot.paidThisMonthCount === 1 ? "" : "s"} settled in ${snapshot.monthLabel}`}
          icon={<CircleDollarSign aria-hidden />}
          badge="Settled"
          variant="emerald"
        />
        <KpiCard
          label="Outstanding"
          value={`$${centsToAmountString(snapshot.outstandingCents)}`}
          hint={`${snapshot.outstandingCount} sent or overdue across clients`}
          icon={<Clock3 aria-hidden />}
          badge="In Flight"
          variant="blue"
        />
        <KpiCard
          label="Overdue"
          value={`$${centsToAmountString(snapshot.overdueCents)}`}
          hint={`${snapshot.overdueCount} past invoice due date`}
          icon={<AlertTriangle aria-hidden />}
          badge={snapshot.overdueCount > 0 ? "Action Required" : "Zero Overdue"}
          variant={snapshot.overdueCount > 0 ? "rose" : "zinc"}
        />
        <KpiCard
          label="Drafts (Unsent)"
          value={`$${centsToAmountString(snapshot.draftCents)}`}
          hint={`${snapshot.draftCount} draft proposal${snapshot.draftCount === 1 ? "" : "s"} awaiting dispatch`}
          icon={<FilePenLine aria-hidden />}
          badge="Local"
          variant="zinc"
        />
      </div>

      {/* Mid-Section: 2-Column Responsive Split Grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column (6 cols): Cash Runway Forecast + Monthly AI Briefing */}
        <div className="space-y-6 lg:col-span-6">
          <CashForecastChart weeks={forecast.weeks} />
          <MonthlySummary />
        </div>

        {/* Right Column (6 cols): Client Behavioral Risk Intelligence */}
        <div className="space-y-6 lg:col-span-6">
          <ClientRiskGrid rows={behaviors} />
        </div>
      </div>

      {/* Bottom Section: Full-Width Earnings Ledger */}
      <div className="w-full">
        <EarningsGrid rows={rows} nowMs={now} />
      </div>
    </div>
  );
}

