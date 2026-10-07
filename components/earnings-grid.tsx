"use client";

import { AgGridProvider, AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  colorSchemeDark,
  themeQuartz,
  type ColDef,
  type IRowNode,
  type CellClickedEvent,
  type RowClickedEvent,
} from "ag-grid-community";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EarningsRow } from "@/lib/invoices/earnings";
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

export type DashboardView = "all" | "overdue" | "outstanding" | "paidMonth";

function inCurrentUtcMonth(ms: number | null, nowMs: number): boolean {
  if (ms == null) {
    return false;
  }
  const now = new Date(nowMs);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return ms >= start && ms < end;
}

function matchesView(row: EarningsRow, view: DashboardView, nowMs: number): boolean {
  switch (view) {
    case "overdue":
      return row.displayStatus === "OVERDUE";
    case "outstanding":
      return row.displayStatus === "SENT" || row.displayStatus === "OVERDUE";
    case "paidMonth":
      return row.displayStatus === "PAID" && inCurrentUtcMonth(row.paidAtMs, nowMs);
    default:
      return true;
  }
}

export function EarningsGrid({ rows, nowMs }: { rows: EarningsRow[]; nowMs: number }) {
  const router = useRouter();
  const gridRef = useRef<AgGridReact<EarningsRow>>(null);
  const [view, setView] = useState<DashboardView>("all");
  const viewRef = useRef(view);
  viewRef.current = view;

  const visibleCount = useMemo(
    () => rows.filter((row) => matchesView(row, view, nowMs)).length,
    [rows, view, nowMs],
  );

  const columnDefs = useMemo<ColDef<EarningsRow>[]>(
    () => [
      { field: "clientName", headerName: "Client", minWidth: 160, filter: true },
      { field: "clientEmail", headerName: "Email", minWidth: 180, filter: true },
      {
        field: "amountUsd",
        headerName: "Amount (USD)",
        minWidth: 130,
        filter: true,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value == null ? "" : `$${centsToAmountString(Math.round(Number(params.value) * 100))}`,
      },
      { field: "displayStatus", headerName: "Status", minWidth: 120, filter: true },
      { field: "riskBand", headerName: "Risk", minWidth: 100, filter: true },
      { field: "riskScore", headerName: "Score", minWidth: 90, type: "numericColumn" },
      { field: "dueDate", headerName: "Due", minWidth: 110, filter: true },
      { field: "paidAt", headerName: "Paid", minWidth: 110, filter: true },
      { field: "createdAt", headerName: "Created", minWidth: 110, filter: true },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<EarningsRow>>(
    () => ({
      sortable: true,
      resizable: true,
      flex: 1,
    }),
    [],
  );

  const isExternalFilterPresent = useCallback(() => viewRef.current !== "all", []);
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<EarningsRow>) => {
      const row = node.data;
      return row ? matchesView(row, viewRef.current, nowMs) : false;
    },
    [nowMs],
  );

  useEffect(() => {
    gridRef.current?.api?.onFilterChanged();
  }, [view]);

  function openInvoice(id: string | undefined): void {
    if (id) {
      router.push(`/invoices/${id}`);
    }
  }

  function onRowClicked(event: RowClickedEvent<EarningsRow>): void {
    openInvoice(event.data?.id);
  }

  function onCellClicked(event: CellClickedEvent<EarningsRow>): void {
    openInvoice(event.data?.id);
  }

  const views: Array<{ id: DashboardView; label: string }> = [
    { id: "all", label: "All" },
    { id: "overdue", label: "Overdue" },
    { id: "outstanding", label: "Outstanding" },
    { id: "paidMonth", label: "Paid this month" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                view === item.id
                  ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {visibleCount === 1 ? "1 invoice" : `${visibleCount} invoices`}
        </p>
      </div>
      <AgGridProvider modules={modules}>
        <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <AgGridReact<EarningsRow>
            ref={gridRef}
            theme={theme}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination
            paginationPageSize={10}
            paginationPageSizeSelector={false}
            animateRows={false}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            onRowClicked={onRowClicked}
            onCellClicked={onCellClicked}
            getRowId={(params) => params.data.id}
          />
        </div>
      </AgGridProvider>
      <p className="text-xs text-zinc-500">Click a row to open the invoice. Amounts are USD.</p>
    </div>
  );
}
