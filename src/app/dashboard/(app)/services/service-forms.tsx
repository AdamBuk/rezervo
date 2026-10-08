"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Service } from "@/lib/database.types";
import { createService, deleteService, updateService } from "./actions";

function ServiceFields({ service }: { service?: Service }) {
  const idPrefix = service?.id ?? "new";
  return (
    <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="label">
          Název
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={100}
          defaultValue={service?.name}
          placeholder="např. Pánský střih"
          className="input"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-duration`} className="label">
          Délka (min)
        </label>
        <input
          id={`${idPrefix}-duration`}
          name="duration_minutes"
          type="number"
          required
          min={5}
          max={480}
          step={5}
          defaultValue={service?.duration_minutes ?? 30}
          className="input"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-price`} className="label">
          Cena (Kč)
        </label>
        <input
          id={`${idPrefix}-price`}
          name="price_czk"
          type="number"
          required
          min={0}
          step={1}
          defaultValue={service?.price_czk}
          className="input"
        />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-description`} className="label">
          Popis <span className="font-normal text-stone-400">(nepovinné)</span>
        </label>
        <input
          id={`${idPrefix}-description`}
          name="description"
          maxLength={300}
          defaultValue={service?.description ?? ""}
          className="input"
        />
      </div>
    </div>
  );
}

export function NewServiceForm() {
  const [state, formAction] = useActionState(createService, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <ServiceFields />
      <FormMessage state={state} />
      <SubmitButton pendingText="Přidávám…">Přidat službu</SubmitButton>
    </form>
  );
}

export function ServiceItem({ service }: { service: Service }) {
  const [updateState, updateAction] = useActionState(updateService, undefined);
  const [deleteState, deleteAction] = useActionState(deleteService, undefined);

  return (
    <details className="group rounded-xl border border-stone-200 bg-white open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {service.name}
            {!service.is_active && (
              <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                skrytá
              </span>
            )}
          </p>
          <p className="text-sm text-stone-500">
            {formatDuration(service.duration_minutes)} · {formatPrice(service.price_czk)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-brand-700 group-open:hidden">Upravit</span>
        <span className="hidden shrink-0 text-sm font-medium text-stone-500 group-open:inline">Zavřít</span>
      </summary>

      <div className="space-y-4 border-t border-stone-100 p-4">
        <form action={updateAction} className="space-y-4">
          <input type="hidden" name="id" value={service.id} />
          <ServiceFields service={service} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={service.is_active}
              className="size-4 rounded border-stone-300 accent-brand-700"
            />
            Nabízet na rezervační stránce
          </label>
          <FormMessage state={updateState} />
          <SubmitButton>Uložit</SubmitButton>
        </form>

        <form action={deleteAction} className="border-t border-stone-100 pt-4">
          <input type="hidden" name="id" value={service.id} />
          <FormMessage state={deleteState} />
          <SubmitButton className="btn-danger mt-2" pendingText="Mažu…">
            Smazat službu
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}
