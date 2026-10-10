"use client";

import { useTheme } from "@/lib/use-theme";

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
        title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
      className="flex w-full items-center justify-between rounded-xl border border-zinc-200/90 bg-white/70 px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs transition hover:bg-white active:scale-98 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <div className="flex items-center gap-2">
        <span>{theme === "dark" ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
      </div>
      <span className="rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Switch
      </span>
    </button>
  );
}
