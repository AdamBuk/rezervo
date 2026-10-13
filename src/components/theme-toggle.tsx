"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark" | "system";

const listeners = new Set<() => void>();

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: React.ReactNode }> = [
  {
    value: "light",
    label: "Světlý",
    icon: (
      <>
        <circle cx="10" cy="10" r="3.25" />
        <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.06 1.06M14.24 14.24l1.06 1.06M4.7 15.3l1.06-1.06M14.24 5.76l1.06-1.06" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Tmavý",
    icon: <path d="M16.5 12.2A6.75 6.75 0 0 1 7.8 3.5a6.75 6.75 0 1 0 8.7 8.7Z" />,
  },
  {
    value: "system",
    label: "Podle systému",
    icon: (
      <>
        <rect x="2.75" y="3.75" width="14.5" height="10" rx="1.75" />
        <path d="M7 17h6M10 13.75V17" />
      </>
    ),
  },
];

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Mirrors THEME_INIT_SCRIPT. Transitions are suspended for one frame so colors switch at once. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  root.classList.add("theme-switching");
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    applyTheme(readTheme());
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Three-way segmented control: light / dark / follow the OS. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server and during hydration: no option is marked until the stored choice is known.
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, () => null);

  // While following the OS, react to it switching (e.g. automatic dark mode at sunset).
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const select = useCallback((next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice still applies for this page view.
    }
    applyTheme(next);
    listeners.forEach((notify) => notify());
  }, []);

  return (
    <div
      role="group"
      aria-label="Barevný motiv"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-edge bg-surface/60 p-1 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={active}
            title={option.label}
            className={`grid size-7 place-items-center rounded-full transition-[color,background-color,box-shadow,transform] duration-150 ease-(--ease-out) active:scale-90 motion-reduce:active:scale-100 ${
              active
                ? "bg-ink text-on-ink"
                : "text-stone-500 hover:bg-sand-100 hover:text-stone-900"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden
            >
              {option.icon}
            </svg>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

