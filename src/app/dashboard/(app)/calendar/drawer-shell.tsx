"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  closeHref: string;
  labelledBy: string;
  children: React.ReactNode;
};

/** Modal side panel: focus moves inside, Tab stays inside, Esc closes, page doesn't scroll behind it. */
export function DrawerShell({ closeHref, labelledBy, children }: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Esc in a form field (e.g. closing the native date picker) must not discard what's being edited.
        const target = e.target as HTMLElement | null;
        if (e.defaultPrevented || target?.closest("input, select, textarea")) return;
        e.preventDefault();
        router.push(closeHref, { scroll: false });
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [closeHref, router]);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="relative flex h-full w-full max-w-md animate-[drawer-in_280ms_var(--ease-drawer)] flex-col overflow-y-auto overscroll-contain border-l border-edge/70 bg-surface/80 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 outline-none motion-reduce:animate-[fade-in_150ms_ease-out]"
    >
      {children}
    </aside>
  );
}
