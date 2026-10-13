"use client";

import { useState } from "react";
import { WEEKDAYS } from "@/lib/constants";
import { trimSeconds } from "@/lib/format";

export type HoursRow = { weekday: number; opens_at: string; closes_at: string };

/** Working-hours editor of a staff member: business opening hours, or an own schedule per weekday. */
export function StaffHoursFields({
  idPrefix,
  usesBusinessHours,
  staffHours,
  openingHours,
}: {
  idPrefix: string;
  usesBusinessHours: boolean;
  staffHours: HoursRow[];
  openingHours: HoursRow[];
}) {
  const [custom, setCustom] = useState(!usesBusinessHours);
  // New schedules start from the opening hours, so the owner only edits the differences.
  const initial = usesBusinessHours ? openingHours : staffHours;
  const [workDays, setWorkDays] = useState(() => new Set(initial.map((h) => h.weekday)));

  return (
    <fieldset className="space-y-2">
      <legend className="label">Pracovní doba</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="uses_business_hours"
          checked={!custom}
          onChange={(e) => setCustom(!e.target.checked)}
          className="size-4 rounded border-stone-300 accent-brand-700"
        />
        Pracuje celou otevírací dobu podniku
      </label>
      {custom && (
        <ul className="animate-[rise-in_200ms_var(--ease-out)] divide-y divide-edge rounded-lg border border-edge px-3 motion-reduce:animate-none">
          {WEEKDAYS.map((day) => {
            const current = initial.find((h) => h.weekday === day.iso);
            const opening = openingHours.find((h) => h.weekday === day.iso);
            const works = workDays.has(day.iso);
            return (
              <li key={day.iso} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                <label className="flex w-28 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name={`work_${day.iso}`}
                    checked={works}
                    disabled={!opening}
                    onChange={(e) => {
                      const next = new Set(workDays);
                      if (e.target.checked) next.add(day.iso);
                      else next.delete(day.iso);
                      setWorkDays(next);
                    }}
                    className="size-4 rounded border-stone-300 accent-brand-700 disabled:opacity-40"
                  />
                  {day.label}
                </label>
                {!opening ? (
                  <span className="text-sm text-stone-400">Podnik má zavřeno</span>
                ) : works ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      id={`${idPrefix}-opens-${day.iso}`}
                      name={`opens_${day.iso}`}
                      aria-label={`${day.label} – od`}
                      step={300}
                      required
                      min={trimSeconds(opening.opens_at)}
                      max={trimSeconds(opening.closes_at)}
                      defaultValue={trimSeconds(current?.opens_at ?? opening.opens_at)}
                      className="input w-28 py-1.5"
                    />
                    <span className="text-stone-400">–</span>
                    <input
                      type="time"
                      id={`${idPrefix}-closes-${day.iso}`}
                      name={`closes_${day.iso}`}
                      aria-label={`${day.label} – do`}
                      step={300}
                      required
                      min={trimSeconds(opening.opens_at)}
                      max={trimSeconds(opening.closes_at)}
                      defaultValue={trimSeconds(current?.closes_at ?? opening.closes_at)}
                      className="input w-28 py-1.5"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-stone-400">Volno</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
