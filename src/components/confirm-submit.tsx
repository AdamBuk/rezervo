"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitButton } from "./submit-button";

type Props = {
  /** Label of the first (non-destructive) button */
  label: string;
  /** Question shown in the confirmation step */
  question: string;
  confirmLabel: string;
  pendingText: string;
  className?: string;
};

/**
 * Two-step submit for destructive actions inside a <form>: the first click asks,
 * the second submits. Esc or "Zpět" cancels; focus moves to the safe choice.
 */
export function ConfirmSubmit({ label, question, confirmLabel, pendingText, className = "btn-danger" }: Props) {
  const [confirming, setConfirming] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) return;
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <div role="group" aria-label={question} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-stone-600">{question}</span>
      <SubmitButton className="btn-destructive" pendingText={pendingText}>
        {confirmLabel}
      </SubmitButton>
      <button ref={backRef} type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
        Zpět
      </button>
    </div>
  );
}
