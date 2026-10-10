import Link from "next/link";
import { ActivityTable } from "@/components/activity-table";
import { WebhookSimulator } from "@/components/webhook-simulator";
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
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-400">
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
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="font-semibold uppercase tracking-wider">Total Recorded Events</span>
            <span>📜</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {logs.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Stored in persistent libSQL audit table</p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-white p-4 shadow-xs dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs text-purple-400">
            <span className="font-semibold uppercase tracking-wider">AI Agent Actions</span>
            <span>✦</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-purple-500">
            {agentCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Autonomous draft proposals & insights</p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-white p-4 shadow-xs dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs text-blue-400">
            <span className="font-semibold uppercase tracking-wider">User Confirmations</span>
            <span>👤</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-blue-500">
            {userCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Human-in-the-Loop approvals & reminders</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-white p-4 shadow-xs dark:bg-zinc-950">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold uppercase tracking-wider">Webhook / Sync Events</span>
            <span>⚡</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-emerald-500">
            {webhookCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Real-time PayPal sandbox events</p>
        </div>
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

