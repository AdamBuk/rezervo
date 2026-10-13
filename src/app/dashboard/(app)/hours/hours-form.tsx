"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { WEEKDAYS } from "@/lib/constants";
import { trimSeconds } from "@/lib/format";
import type { OpeningHours } from "@/lib/database.types";
import { saveOpeningHours } from "./actions";

export function HoursForm({ hours }: { hours: OpeningHours[] }) {
  const [state, formAction] = useActionState(saveOpeningHours, undefined);
  const [openDays, setOpenDays] = useState(() => new Set(hours.map((h) => h.weekday)));

  return (
    <form action={formAction} className="space-y-4">
      <ul className="divide-y divide-edge">
        {WEEKDAYS.map((day) => {
          const current = hours.find((h) => h.weekday === day.iso);
          const isOpen = openDays.has(day.iso);
          return (
            <li key={day.iso} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
              <label className="flex w-32 items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  name={`open_${day.iso}`}
                  checked={isOpen}
                  onChange={(e) => {
                    const next = new Set(openDays);
                    if (e.target.checked) next.add(day.iso);
                    else next.delete(day.iso);
                    setOpenDays(next);
                  }}
                  className="size-4 rounded border-stone-300 accent-brand-700"
                />
                {day.label}
              </label>
              {isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name={`opens_${day.iso}`}
                    aria-label={`${day.label} – otevírá`}
                    step={300}
                    required
                    defaultValue={current ? trimSeconds(current.opens_at) : "09:00"}
                    className="input w-28 py-1.5"
                  />
                  <span className="text-stone-400">–</span>
                  <input
                    type="time"
                    name={`closes_${day.iso}`}
                    aria-label={`${day.label} – zavírá`}
                    step={300}
                    required
                    defaultValue={current ? trimSeconds(current.closes_at) : "17:00"}
                    className="input w-28 py-1.5"
                  />
                </div>
              ) : (
                <span className="text-sm text-stone-400">Zavřeno</span>
              )}
            </li>
          );
        })}
      </ul>
      <FormMessage state={state} />
      <SubmitButton>Uložit otevírací dobu</SubmitButton>
    </form>
  );
}
