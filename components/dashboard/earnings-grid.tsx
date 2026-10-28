"use client";

import { AgGridProvider, AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  colorSchemeDark,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type IRowNode,
  type CellClickedEvent,
  type RowClickedEvent,
} from "ag-grid-community";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EarningsRow } from "@/lib/invoices/earnings";
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

function StatusCell(params: ICellRendererParams<EarningsRow>) {
  const status = params.value as string | undefined;
  if (!status) return null;

  const styles: Record<string, string> = {
    PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    SENT: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    OVERDUE: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    CANCELLED: "bg-zinc-600/15 text-zinc-400 border-zinc-600/30",
  };

  const dots: Record<string, string> = {
    PAID: "bg-emerald-400",
    SENT: "bg-blue-400",
    OVERDUE: "bg-rose-400 animate-pulse",
    DRAFT: "bg-zinc-400",
    CANCELLED: "bg-zinc-500",
  };

  return (
    <div className="flex h-full items-center">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
          styles[status] ?? "border-zinc-700 bg-zinc-800 text-zinc-300"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dots[status] ?? "bg-zinc-400"}`} />
        <span>{status}</span>
      </span>
    </div>
  );
}

function RiskCell(params: ICellRendererParams<EarningsRow>) {
  const band = params.value as string | undefined;
  if (!band) return null;

  const styles: Record<string, string> = {
    low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  return (
    <div className="flex h-full items-center">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize ${
          styles[band] ?? "border-zinc-700 bg-zinc-800 text-zinc-400"
        }`}
      >
        {band}
      </span>
    </div>
  );
}

export function EarningsGrid({ rows, nowMs }: { rows: EarningsRow[]; nowMs: number }) {
  const router = useRouter();
  const gridRef = useRef<AgGridReact<EarningsRow>>(null);
  const [view, setView] = useState<DashboardView>("all");
  const [searchText, setSearchText] = useState("");
  const { isDark } = useTheme();
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

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
      {
        field: "displayStatus",
        headerName: "Status",
        minWidth: 120,
        cellRenderer: StatusCell,
        filter: true,
      },
      {
        field: "riskBand",
        headerName: "Risk",
        minWidth: 100,
        cellRenderer: RiskCell,
        filter: true,
      },
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

  const handleSearch = (text: string) => {
    setSearchText(text);
    gridRef.current?.api?.setGridOption("quickFilterText", text);
  };

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({
      fileName: `paypilot-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

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
      {/* Interactive Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                view === item.id
                  ? "bg-zinc-950 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950"
                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-zinc-400">
              🔍
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Quick search..."
              className="h-8 w-44 rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs outline-none transition focus:w-56 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-600"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => handleSearch("")}
                className="absolute inset-y-0 right-2 flex items-center text-xs text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Native CSV Export (AG Grid feature) */}
          <button
            type="button"
            onClick={handleExportCsv}
            title="Export all rows to CSV"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>

          <p className="pl-1 text-xs text-zinc-500">
            {visibleCount === 1 ? "1 invoice" : `${visibleCount} invoices`}
          </p>
        </div>
      </div>

      {/* Grid container */}
      <AgGridProvider modules={modules}>
        <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800">
          <AgGridReact<EarningsRow>
            ref={gridRef}
            theme={isDark ? darkTheme : lightTheme}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination
            paginationPageSize={10}
            paginationPageSizeSelector={[5, 10, 20, 50]}
            animateRows={false}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            onRowClicked={onRowClicked}
            onCellClicked={onCellClicked}
            getRowId={(params) => params.data.id}
          />
        </div>
      </AgGridProvider>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <p>Click any row to open invoice details. Amounts are USD.</p>
        <p className="hidden text-[11px] text-zinc-400 sm:block">
          Powered by AG Grid Community • Sort, filter & export supported
        </p>
      </div>
    </div>
  );
}
