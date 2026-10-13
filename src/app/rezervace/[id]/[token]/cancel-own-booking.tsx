"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { cancelOwnBooking, type CancelState } from "./actions";

type Props = { bookingId: string; token: string; bookAgainHref: string };

export function CancelOwnBooking({ bookingId, token, bookAgainHref }: Props) {
  const [state, formAction] = useActionState<CancelState, FormData>(cancelOwnBooking, { status: "idle" });
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Re-render the server part (status badge, cancelled panel) once the booking is cancelled.
  useEffect(() => {
    if (state.status === "cancelled") router.refresh();
  }, [state.status, router]);

  useEffect(() => {
    if (!confirming) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  if (state.status === "cancelled") {
    return (
      <div className="animate-[rise-in_220ms_var(--ease-out)] rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 motion-reduce:animate-[fade-in_150ms_ease-out]" role="status">
        <p className="font-semibold">Rezervace je zrušená.</p>
        <p className="mt-1">Potvrzení jsme vám poslali e-mailem a podnik o zrušení ví.</p>
        <Link href={bookAgainHref} className="mt-2 inline-block link">
          Vybrat jiný termín →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {confirming ? (
        <div role="group" aria-labelledby="cancel-confirm" className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <p id="cancel-confirm" className="text-sm text-stone-700">
            Opravdu chcete rezervaci zrušit? Termín se uvolní pro ostatní zákazníky.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SubmitButton className="btn-destructive" pendingText="Ruším…">
              Ano, zrušit rezervaci
            </SubmitButton>
            <button ref={keepRef} type="button" onClick={() => setConfirming(false)} className="btn-secondary">
              Ponechat
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-500">Nemůžete přijít? Uvolněte termín pro ostatní.</p>
          <button type="button" onClick={() => setConfirming(true)} className="btn-danger">
            Zrušit rezervaci
          </button>
        </div>
      )}
    </form>
  );
}
