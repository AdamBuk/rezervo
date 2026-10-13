"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { cancelBooking, rescheduleBooking } from "./actions";

type Props = {
  bookingId: string;
  defaultDate: string;
  defaultTime: string;
  defaultStaffId: string;
  /** Staff the booking can be moved to; the picker shows only with more than one */
  staffOptions: { id: string; name: string }[];
  stepMinutes: number;
};

export function BookingActions({ bookingId, defaultDate, defaultTime, defaultStaffId, staffOptions, stepMinutes }: Props) {
  const [moveState, moveAction] = useActionState(rescheduleBooking, undefined);
  const [cancelState, cancelAction] = useActionState(cancelBooking, undefined);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Controlled, so React's automatic form reset after the action doesn't wipe the owner's input on error.
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [staffId, setStaffId] = useState(defaultStaffId);

  return (
    <div className="space-y-6">
      <form action={moveAction} className="space-y-3 rounded-xl border border-edge bg-sand-50/60 p-4">
        <h3 className="font-medium">Přesunout na jiný termín</h3>
        <input type="hidden" name="id" value={bookingId} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="move-date" className="label">
              Datum
            </label>
            <input id="move-date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
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
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />
          </div>
        </div>
        {staffOptions.length > 1 ? (
          <div>
            <label htmlFor="move-staff" className="label">
              Pracovník
            </label>
            <select id="move-staff" name="staff_id" value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input">
              {staffOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="staff_id" value={staffId} />
        )}
        <FormMessage state={moveState} />
        <SubmitButton pendingText="Přesouvám…">Přesunout</SubmitButton>
      </form>

      <form action={cancelAction} className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-4">
        <h3 className="font-medium">Zrušit rezervaci</h3>
        <input type="hidden" name="id" value={bookingId} />
        <FormMessage state={cancelState} />
        {confirmCancel ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-600">Opravdu zrušit? Zákazník dostane e-mail.</span>
            <SubmitButton className="btn-destructive" pendingText="Ruším…">
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
