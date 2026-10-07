"use client";

import { AgGridProvider, AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  colorSchemeDark,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { useMemo, useState } from "react";
import type { ClientBehavior } from "@/lib/insights/behavior";
import { centsToAmountString } from "@/lib/money";

const modules = [AllCommunityModule];
const theme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#09090b",
  foregroundColor: "#fafafa",
  borderColor: "#27272a",
  headerBackgroundColor: "#18181b",
  oddRowBackgroundColor: "#09090b",
  browserColorScheme: "dark",
});

function WhyCell(params: ICellRendererParams<ClientBehavior>) {
  const clientId = params.data?.clientId;
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explain(): Promise<void> {
    if (!clientId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/insights/why", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const body = (await response.json()) as { ok?: boolean; text?: string; error?: string };
      if (!response.ok || !body.ok || !body.text) {
        setError(body.error ?? "Could not explain risk.");
        return;
      }
      setText(body.text);
    } catch {
      setError("Could not reach the explain endpoint.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full items-center gap-2 py-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void explain()}
        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-900 disabled:opacity-60"
      >
        {pending ? "…" : "Why?"}
      </button>
      {error ? <span className="truncate text-[11px] text-red-400">{error}</span> : null}
      {text ? <span className="truncate text-[11px] text-zinc-300">{text}</span> : null}
    </div>
  );
}

export function ClientRiskGrid({ rows }: { rows: ClientBehavior[] }) {
  const columnDefs = useMemo<ColDef<ClientBehavior>[]>(
    () => [
      { field: "clientName", headerName: "Client", minWidth: 140, filter: true },
      { field: "riskScore", headerName: "Risk", minWidth: 80, type: "numericColumn", sort: "desc" },
      { field: "riskBand", headerName: "Band", minWidth: 90, filter: true },
      {
        headerName: "Why?",
        minWidth: 220,
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

  return (
    <section className="space-y-2">
      <div>
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Client risk</p>
        <p className="text-xs text-zinc-500">
          Score = clamp(round(55 × lateRate + 2.5 × avgDaysLate + 8 × openOverdue), 0, 100). Why?
          is an LLM explanation of those facts.
        </p>
      </div>
      <AgGridProvider modules={modules}>
        <div className="h-[320px] w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <AgGridReact<ClientBehavior>
            theme={theme}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => params.data.clientId}
            animateRows={false}
          />
        </div>
      </AgGridProvider>
    </section>
  );
}
