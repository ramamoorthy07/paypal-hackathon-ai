import type { DisplayStatus } from "@/lib/invoices/state";

const STYLES: Record<DisplayStatus, string> = {
  DRAFT: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  SENT: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
  OVERDUE: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
  PAID: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  CANCELLED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
