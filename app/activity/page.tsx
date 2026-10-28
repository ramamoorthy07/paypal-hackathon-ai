import Link from "next/link";
import { ArrowRight, Bot, ScrollText, UserRound, Zap } from "lucide-react";
import { ActivityTable } from "@/components/activity/activity-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { WebhookSimulator } from "@/components/activity/webhook-simulator";
import { listRecentAuditLogs } from "@/lib/db/repositories/audit-log";
import { listInvoiceViews } from "@/lib/invoices/views";

export const dynamic = "force-dynamic";

export default async function ActivityHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string }>;
}) {
  const { actor } = await searchParams;
  const [logs, invoices] = await Promise.all([
    listRecentAuditLogs(100),
    listInvoiceViews(),
  ]);

  const filter = actor?.toLowerCase();
  const visible = filter ? logs.filter((l) => l.actor.toLowerCase() === filter) : logs;

  const agentCount = logs.filter((l) => l.actor === "agent").length;
  const userCount = logs.filter((l) => l.actor === "user").length;
  const webhookCount = logs.filter((l) => l.actor === "webhook").length;
  const simulatorCount = logs.filter((l) => l.actor === "simulator").length;

  const simulatorInvoices = invoices.map((inv) => ({
    id: inv.id,
    clientName: inv.clientName,
    amountCents: inv.amountCents,
    currency: inv.currency,
    status: inv.status,
    displayStatus: inv.displayStatus,
    paypalInvoiceId: inv.paypalInvoiceId,
  }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Audit & Activity History
            </h1>
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-400">
              Immutable Trail
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Chronological audit log tracking AI Agent actions, User Human-in-the-Loop confirmations, and PayPal events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/invoices"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span>Invoices Ledger</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Recorded Events"
          value={String(logs.length)}
          hint="Stored in persistent libSQL audit table"
          icon={<ScrollText aria-hidden />}
          variant="zinc"
        />
        <KpiCard
          label="AI Agent Actions"
          value={String(agentCount)}
          hint="Autonomous draft proposals & insights"
          icon={<Bot aria-hidden />}
          variant="zinc"
        />
        <KpiCard
          label="User Confirmations"
          value={String(userCount)}
          hint="Human-in-the-Loop approvals & reminders"
          icon={<UserRound aria-hidden />}
          variant="blue"
        />
        <KpiCard
          label="Webhook / Sync Events"
          value={String(webhookCount)}
          hint="Real-time PayPal sandbox events"
          icon={<Zap aria-hidden />}
          variant="emerald"
        />
      </div>

      {/* Interactive Webhook Simulator for Judges & Testing */}
      <WebhookSimulator invoices={simulatorInvoices} />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "", label: "All Activity", count: logs.length },
            { id: "agent", label: "Agent Actions", count: agentCount },
            { id: "user", label: "User Confirmations", count: userCount },
            { id: "webhook", label: "PayPal Webhooks", count: webhookCount },
            { id: "simulator", label: "Simulated Webhooks", count: simulatorCount },
          ].map((item) => {
            const active = (filter ?? "") === item.id;
            const href = item.id ? `/activity?actor=${item.id}` : "/activity";
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
                  {item.count}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">Showing {visible.length} events</p>
      </div>

      {/* Paginated Activity Table with Frozen Header and Search */}
      <ActivityTable logs={visible} />
    </div>
  );
}

