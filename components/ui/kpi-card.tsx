import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  badge,
  variant = "zinc",
}: {
  label: string;
  value: string;
  hint: string;
  icon?: ReactNode;
  badge?: string;
  variant?: "emerald" | "blue" | "rose" | "zinc";
}) {
  const borderStyles = {
    emerald: "border-emerald-500/20 dark:border-emerald-500/20",
    blue: "border-blue-500/20 dark:border-blue-500/20",
    rose: "border-rose-500/20 dark:border-rose-500/20",
    zinc: "border-zinc-200 dark:border-zinc-800",
  };

  const badgeStyles = {
    emerald:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
    rose: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400",
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-zinc-950 ${borderStyles[variant]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon ? (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </span>
          ) : null}
          <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{label}</p>
        </div>
        {badge ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeStyles[variant]}`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-zinc-950 sm:text-3xl dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
