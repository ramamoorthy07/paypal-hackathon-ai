"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribe(callback: () => void): () => void {
  window.addEventListener("paypilot:theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("paypilot:theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function useTheme(): {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setTheme(next: Theme): void {
    if (typeof document !== "undefined") {
      if (next === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
      }
      try {
        localStorage.setItem("paypilot_theme", next);
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent("paypilot:theme-change", { detail: next }));
    }
  }

  function toggleTheme(): void {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
