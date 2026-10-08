"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { cancelBooking, rescheduleBooking } from "./actions";

type Props = {
  bookingId: string;
  defaultDate: string;
  defaultTime: string;
  stepMinutes: number;
};

export function BookingActions({ bookingId, defaultDate, defaultTime, stepMinutes }: Props) {
  const [moveState, moveAction] = useActionState(rescheduleBooking, undefined);
  const [cancelState, cancelAction] = useActionState(cancelBooking, undefined);
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <div className="space-y-6">
      <form action={moveAction} className="space-y-3 rounded-xl border border-stone-200 p-4">
        <h3 className="font-semibold">Přesunout na jiný termín</h3>
        <input type="hidden" name="id" value={bookingId} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="move-date" className="label">
              Datum
            </label>
            <input id="move-date" name="date" type="date" required defaultValue={defaultDate} className="input" />
          </div>
          <div>
            <label htmlFor="move-time" className="label">
              Čas
            </label>
            <input
              id="move-time"
              name="time"
              type="time"
              required
              step={stepMinutes * 60}
              defaultValue={defaultTime}
              className="input"
            />
          </div>
        </div>
        <FormMessage state={moveState} />
        <SubmitButton pendingText="Přesouvám…">Přesunout</SubmitButton>
      </form>

      <form action={cancelAction} className="space-y-3 rounded-xl border border-red-100 p-4">
        <h3 className="font-semibold">Zrušit rezervaci</h3>
        <input type="hidden" name="id" value={bookingId} />
        <FormMessage state={cancelState} />
        {confirmCancel ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-600">Opravdu zrušit? Zákazník dostane e-mail.</span>
            <SubmitButton className="btn bg-red-600 text-white hover:bg-red-700" pendingText="Ruším…">
              Ano, zrušit
            </SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setConfirmCancel(false)}>
              Ne
            </button>
          </div>
        ) : (
          <button type="button" className="btn-danger" onClick={() => setConfirmCancel(true)}>
            Zrušit rezervaci
          </button>
        )}
      </form>
    </div>
  );
}
