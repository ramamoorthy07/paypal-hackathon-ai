import { AppHeader } from "@/components/app-header";
import { CashForecastChart } from "@/components/cash-forecast-chart";
import { ClientRiskGrid } from "@/components/client-risk-grid";
import { EarningsGrid } from "@/components/earnings-grid";
import { KpiCard } from "@/components/kpi-card";
import { MonthlySummary } from "@/components/monthly-summary";
import { earningsSnapshot, toEarningsRow } from "@/lib/invoices/earnings";
import { insightsSnapshot } from "@/lib/insights/queries";
import { centsToAmountString } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = Date.now();
  const { invoices, behaviors, forecast } = await insightsSnapshot(now);
  const snapshot = earningsSnapshot(invoices, now);
  const byClient = new Map(behaviors.map((row) => [row.clientId, row]));
  const rows = invoices.map((invoice) => toEarningsRow(invoice, byClient.get(invoice.clientId)));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="Earnings" wide />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Paid this month"
            value={`$${centsToAmountString(snapshot.paidThisMonthCents)}`}
            hint={`${snapshot.paidThisMonthCount} invoice${snapshot.paidThisMonthCount === 1 ? "" : "s"} in ${snapshot.monthLabel}`}
          />
          <KpiCard
            label="Outstanding"
            value={`$${centsToAmountString(snapshot.outstandingCents)}`}
            hint={`${snapshot.outstandingCount} sent or overdue`}
          />
          <KpiCard
            label="Overdue"
            value={`$${centsToAmountString(snapshot.overdueCents)}`}
            hint={`${snapshot.overdueCount} past due`}
          />
          <KpiCard
            label="Drafts"
            value={`$${centsToAmountString(snapshot.draftCents)}`}
            hint={`${snapshot.draftCount} not sent to PayPal`}
          />
        </div>

        <CashForecastChart weeks={forecast.weeks} />
        <ClientRiskGrid rows={behaviors} />
        <EarningsGrid rows={rows} nowMs={now} />
        <MonthlySummary />
      </main>
    </div>
  );
}
