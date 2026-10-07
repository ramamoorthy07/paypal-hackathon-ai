import { centsToAmountString } from "@/lib/money";
import type { WeekForecast } from "@/lib/insights/forecast";

export function CashForecastChart({ weeks }: { weeks: WeekForecast[] }) {
  const maxCents = Math.max(
    1,
    ...weeks.map((week) => Math.max(week.highCents, week.expectedCents, week.lowCents)),
  );

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Cash forecast</p>
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Next 6 UTC weeks</h2>
      <p className="mt-1 text-xs text-zinc-500">Expected vs late-pay bands. Totals are computed in code.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {weeks.map((week) => {
          const expectedPct = Math.round((week.expectedCents / maxCents) * 100);
          const lowPct = Math.round((week.lowCents / maxCents) * 100);
          const highPct = Math.round((week.highCents / maxCents) * 100);
          return (
            <div key={week.weekStart} className="flex flex-col gap-2">
              <div className="flex h-36 items-end gap-1 rounded-lg bg-zinc-100 px-2 py-2 dark:bg-zinc-900">
                <div
                  className="w-full rounded-sm bg-zinc-300 dark:bg-zinc-700"
                  style={{ height: `${lowPct}%` }}
                  title={`Low $${centsToAmountString(week.lowCents)}`}
                />
                <div
                  className="w-full rounded-sm bg-[#003087]"
                  style={{ height: `${expectedPct}%` }}
                  title={`Expected $${centsToAmountString(week.expectedCents)}`}
                />
                <div
                  className="w-full rounded-sm bg-emerald-400/80"
                  style={{ height: `${highPct}%` }}
                  title={`High $${centsToAmountString(week.highCents)}`}
                />
              </div>
              <p className="text-[11px] leading-tight text-zinc-500">
                {week.weekStart.slice(5)}
                <span className="block tabular-nums text-zinc-800 dark:text-zinc-200">
                  ${centsToAmountString(week.expectedCents)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Bars per week: low · expected · high. Amounts are USD.
      </p>
    </section>
  );
}
