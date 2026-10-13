"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { ConfirmSubmit } from "@/components/confirm-submit";
import type { Staff } from "@/lib/database.types";
import { createStaff, deleteStaff, updateStaff } from "./actions";
import { StaffHoursFields, type HoursRow } from "./staff-hours-fields";

export type ServiceOption = { id: string; name: string; is_active: boolean };

function StaffFields({
  idPrefix,
  name,
  services,
  checked,
}: {
  idPrefix: string;
  name?: string;
  services: ServiceOption[];
  checked: (serviceId: string) => boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="label">
          Jméno
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={60}
          defaultValue={name}
          placeholder="např. Jana"
          autoComplete="off"
          className="input"
        />
      </div>
      <fieldset>
        <legend className="label">Služby, které dělá</legend>
        {services.length ? (
          <div className="mt-1 grid gap-1.5 @md:grid-cols-2">
            {services.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-edge px-3 py-2 text-sm transition-colors hover:bg-sand-50 has-checked:border-brand-300 has-checked:bg-brand-50/50"
              >
                <input
                  type="checkbox"
                  name="service_ids"
                  value={s.id}
                  defaultChecked={checked(s.id)}
                  className="size-4 rounded border-stone-300 accent-brand-700"
                />
                <span className="truncate">{s.name}</span>
                {!s.is_active && <span className="ml-auto shrink-0 text-xs text-stone-400">skrytá</span>}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">Nejdřív přidejte služby.</p>
        )}
      </fieldset>
    </div>
  );
}

/** "Po, Út, Čt" from schedule rows */
function workdaysLabel(rows: HoursRow[]): string {
  const short = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
  return [...rows].sort((a, b) => a.weekday - b.weekday).map((r) => short[r.weekday - 1]).join(", ") || "žádné dny";
}

export function NewStaffForm({ services }: { services: ServiceOption[] }) {
  const [state, formAction] = useActionState(createStaff, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Same pattern as the new service form: the result hides on the next edit or after a few seconds.
  const [dismissed, setDismissed] = useState<typeof state>(undefined);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    const timer = setTimeout(() => setDismissed(state), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} onInput={() => setDismissed(state)} className="@container space-y-4">
      {/* New staff members do every active service by default; uncheck what they don't. */}
      <StaffFields idPrefix="new-staff" services={services} checked={(id) => services.some((s) => s.id === id && s.is_active)} />
      <FormMessage state={dismissed === state ? undefined : state} />
      <SubmitButton pendingText="Přidávám…">Přidat do týmu</SubmitButton>
    </form>
  );
}

export function StaffItem({
  member,
  services,
  serviceIds,
  staffHours,
  openingHours,
  bookingCount,
}: {
  member: Staff;
  services: ServiceOption[];
  serviceIds: string[];
  staffHours: HoursRow[];
  openingHours: HoursRow[];
  /** Upcoming confirmed bookings */
  bookingCount: number;
}) {
  const [updateState, updateAction] = useActionState(updateStaff, undefined);
  const [deleteState, deleteAction] = useActionState(deleteStaff, undefined);
  const serviceNames = services.filter((s) => serviceIds.includes(s.id)).map((s) => s.name);

  return (
    <details className="group transition-colors open:bg-sand-50/60">
      <summary className="panel-row grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-x-4 [&::-webkit-details-marker]:hidden">
        <span
          className={`grid size-10 place-items-center rounded-full font-display text-base font-bold ${
            member.is_active ? "bg-brand-100 text-brand-700" : "bg-stone-100 text-stone-400"
          }`}
          aria-hidden
        >
          {member.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{member.name}</span>
            {!member.is_active && (
              <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600 uppercase">
                neaktivní
              </span>
            )}
          </p>
          <p className="truncate text-sm text-stone-500">
            {serviceNames.length ? serviceNames.join(", ") : "Žádné služby – zákazníci si ho nemohou vybrat"}
          </p>
          {!member.uses_business_hours && (
            <p className="truncate text-sm text-stone-500">Vlastní pracovní doba · {workdaysLabel(staffHours)}</p>
          )}
        </div>
        <span className="text-right text-sm text-stone-500">
          <span className="hidden tabular-nums sm:inline">
            {bookingCount ? `${bookingCount} ${bookingCount <= 4 ? "rezervace" : "rezervací"} · ` : ""}
          </span>
          <span className="underline decoration-stone-300 underline-offset-4 group-open:hidden">Upravit</span>
          <span className="hidden font-medium group-open:inline">Zavřít</span>
        </span>
      </summary>

      <div className="animate-[rise-in_220ms_var(--ease-out)] space-y-4 border-t border-edge p-4 motion-reduce:animate-none">
        <form action={updateAction} className="@container space-y-4">
          <input type="hidden" name="id" value={member.id} />
          <StaffFields idPrefix={member.id} name={member.name} services={services} checked={(id) => serviceIds.includes(id)} />
          <StaffHoursFields
            idPrefix={member.id}
            usesBusinessHours={member.uses_business_hours}
            staffHours={staffHours}
            openingHours={openingHours}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={member.is_active}
              className="size-4 rounded border-stone-300 accent-brand-700"
            />
            Aktivní – zákazníci si ho mohou rezervovat
          </label>
          {member.is_active && bookingCount > 0 && (
            <p className="text-sm text-stone-500">
              Po deaktivaci zůstanou jeho budoucí rezervace ({bookingCount}) v kalendáři – přesuňte je nebo zrušte.
            </p>
          )}
          <FormMessage state={updateState} />
          <SubmitButton>Uložit</SubmitButton>
        </form>

        <form action={deleteAction} className="border-t border-edge pt-4">
          <input type="hidden" name="id" value={member.id} />
          <FormMessage state={deleteState} />
          <div className="mt-2">
            <ConfirmSubmit
              label="Odebrat z týmu"
              question="Opravdu odebrat? Pracovník s rezervacemi se jen deaktivuje."
              confirmLabel="Ano, odebrat"
              pendingText="Odebírám…"
            />
          </div>
        </form>
      </div>
    </details>
  );
}
