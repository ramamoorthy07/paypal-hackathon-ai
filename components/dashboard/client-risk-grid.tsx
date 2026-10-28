"use client";

import { AgGridProvider, AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  colorSchemeDark,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientBehavior } from "@/lib/insights/behavior";
import { centsToAmountString } from "@/lib/core/money";
import { useTheme } from "@/hooks/use-theme";

const modules = [AllCommunityModule];
const darkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#09090b",
  foregroundColor: "#fafafa",
  borderColor: "#27272a",
  headerBackgroundColor: "#18181b",
  oddRowBackgroundColor: "#09090b",
  browserColorScheme: "dark",
});

const lightTheme = themeQuartz.withParams({
  backgroundColor: "#ffffff",
  foregroundColor: "#09090b",
  borderColor: "#e4e4e7",
  headerBackgroundColor: "#f4f4f5",
  oddRowBackgroundColor: "#ffffff",
  browserColorScheme: "light",
});

type GridContextType = {
  openWhyModal: (client: ClientBehavior) => void;
  cache: Record<string, string>;
  pendingId: string | null;
};

function WhyCell(params: ICellRendererParams<ClientBehavior>) {
  const client = params.data;
  if (!client) return null;

  const context = params.context as GridContextType | undefined;
  if (!context) return null;

  const isPending = context.pendingId === client.clientId;
  const cachedText = context.cache[client.clientId];

  return (
    <div className="flex h-full items-center gap-2 py-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => context.openWhyModal(client)}
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-95 disabled:opacity-60"
        title="Open full AI risk breakdown"
      >
        <span>{isPending ? "Analyzing…" : "Why?"}</span>
        <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden />
      </button>
      {cachedText ? (
        <button
          type="button"
          onClick={() => context.openWhyModal(client)}
          className="truncate text-[11px] text-zinc-600 underline decoration-zinc-400 underline-offset-2 transition hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-200"
          title="Click to read complete explanation"
        >
          {cachedText}
        </button>
      ) : null}
    </div>
  );
}

type ActiveModalState = {
  client: ClientBehavior;
  explanation?: string;
  loading: boolean;
  error?: string;
};

export function ClientRiskGrid({ rows }: { rows: ClientBehavior[] }) {
  const [activeModal, setActiveModal] = useState<ActiveModalState | null>(null);
  const [cache, setCache] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { isDark } = useTheme();

  const openWhyModal = useCallback(
    async (client: ClientBehavior) => {
      if (cache[client.clientId]) {
        setActiveModal({
          client,
          explanation: cache[client.clientId],
          loading: false,
        });
        return;
      }

      setActiveModal({
        client,
        loading: true,
      });
      setPendingId(client.clientId);

      try {
        const response = await fetch("/api/insights/why", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.clientId }),
        });
        const body = (await response.json()) as { ok?: boolean; text?: string; error?: string };
        if (!response.ok || !body.ok || !body.text) {
          setActiveModal({
            client,
            loading: false,
            error: body.error ?? "Could not explain risk.",
          });
          return;
        }
        setCache((prev) => ({ ...prev, [client.clientId]: body.text! }));
        setActiveModal({
          client,
          explanation: body.text,
          loading: false,
        });
      } catch {
        setActiveModal({
          client,
          loading: false,
          error: "Could not reach the explain endpoint.",
        });
      } finally {
        setPendingId(null);
      }
    },
    [cache],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && activeModal) {
        setActiveModal(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  const gridContext = useMemo<GridContextType>(
    () => ({
      openWhyModal,
      cache,
      pendingId,
    }),
    [openWhyModal, cache, pendingId],
  );

  const columnDefs = useMemo<ColDef<ClientBehavior>[]>(
    () => [
      { field: "clientName", headerName: "Client", minWidth: 140, filter: true },
      { field: "riskScore", headerName: "Risk", minWidth: 80, type: "numericColumn", sort: "desc" },
      { field: "riskBand", headerName: "Band", minWidth: 90, filter: true },
      {
        headerName: "Why?",
        minWidth: 240,
        flex: 1,
        cellRenderer: WhyCell,
        sortable: false,
        filter: false,
      },
      {
        field: "lateRate",
        headerName: "Late rate",
        minWidth: 100,
        valueFormatter: (params) =>
          params.value == null ? "" : `${Math.round(Number(params.value) * 100)}%`,
      },
      { field: "avgDaysToPay", headerName: "Avg days to pay", minWidth: 120 },
      { field: "openOverdueCount", headerName: "Open overdue", minWidth: 110 },
      {
        headerName: "Overdue USD",
        minWidth: 110,
        valueGetter: (params) => params.data?.openOverdueCents ?? 0,
        valueFormatter: (params) => `$${centsToAmountString(Number(params.value ?? 0))}`,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<ClientBehavior>>(
    () => ({ sortable: true, resizable: true }),
    [],
  );

  const bandColor = (band: string) => {
    switch (band) {
      case "high":
        return "bg-rose-500/20 text-rose-700 border-rose-500/30 dark:text-rose-300";
      case "medium":
        return "bg-amber-500/20 text-amber-800 border-amber-500/30 dark:text-amber-300";
      default:
        return "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
    }
  };

  return (
    <section className="space-y-2">
      <div>
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Client risk</p>
        <p className="text-xs text-zinc-500">
          Score from late rate, days late, and open overdue. Click Why? to view the AI explanation.
        </p>
      </div>
      <AgGridProvider modules={modules}>
        <div className="h-[320px] w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <AgGridReact<ClientBehavior>
            theme={isDark ? darkTheme : lightTheme}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            context={gridContext}
            getRowId={(params) => params.data.clientId}
            pagination
            paginationPageSize={5}
            paginationPageSizeSelector={[5, 10, 20]}
            animateRows={false}
          />
        </div>
      </AgGridProvider>

      {/* Modal Dialog for Risk Explanation */}
      {activeModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                  Client Risk Breakdown
                </p>
                <h3 className="text-lg font-semibold text-zinc-100">
                  {activeModal.client.clientName}
                </h3>
                <p className="text-xs text-zinc-400">{activeModal.client.clientEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${bandColor(
                    activeModal.client.riskBand,
                  )}`}
                >
                  {activeModal.client.riskBand} Risk ({activeModal.client.riskScore}/100)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5">
                <p className="text-[10px] tracking-wider text-zinc-400 uppercase">Late Rate</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {Math.round(activeModal.client.lateRate * 100)}%
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5">
                <p className="text-[10px] tracking-wider text-zinc-400 uppercase">Avg Days to Pay</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {activeModal.client.avgDaysToPay != null
                    ? `${activeModal.client.avgDaysToPay}d`
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5">
                <p className="text-[10px] tracking-wider text-zinc-400 uppercase">Open Overdue</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {activeModal.client.openOverdueCount} (
                  ${centsToAmountString(activeModal.client.openOverdueCents)})
                </p>
              </div>
            </div>

            {/* AI Explanation Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <span>AI Risk Assessment (Azure OpenAI)</span>
              </div>
              {activeModal.loading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent dark:border-zinc-400" />
                  <span>Analyzing payment timestamps and calculating behavioral risk...</span>
                </div>
              ) : activeModal.error ? (
                <p className="text-xs text-rose-700 dark:text-rose-400">{activeModal.error}</p>
              ) : (
                <p className="text-sm leading-relaxed text-zinc-200">
                  {activeModal.explanation}
                </p>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              Score is calculated deterministically:{" "}
              <code className="text-zinc-400">
                clamp(55 × lateRate + 2.5 × avgDaysLate + 8 × overdueCount, 0, 100)
              </code>
              . The model only explains verified facts.
            </p>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
