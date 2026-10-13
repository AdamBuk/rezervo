"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Service } from "@/lib/database.types";
import { createService, deleteService, updateService } from "./actions";

function ServiceFields({ service }: { service?: Service }) {
  const idPrefix = service?.id ?? "new";
  return (
    <div className="grid grid-cols-2 gap-3 @lg:grid-cols-[2fr_1fr_1fr]">
      <div className="col-span-2 @lg:col-span-1">
        <label htmlFor={`${idPrefix}-name`} className="label">
          Název
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={100}
          defaultValue={service?.name}
          placeholder="např. Pánský střih…"
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
      <div className="col-span-2 @lg:col-span-3">
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
    <form ref={formRef} action={formAction} className="@container space-y-4">
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
    <details className="group transition-colors open:bg-sand-50/60">
      {/* Table-like row: name | duration | price | action, columns aligned across rows */}
      <summary className="panel-row grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 sm:grid-cols-[1fr_6rem_6rem_4.5rem] [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{service.name}</span>
            {!service.is_active && (
              <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600 uppercase">
                skrytá
              </span>
            )}
          </p>
          {service.description && <p className="truncate text-sm text-stone-500">{service.description}</p>}
          <p className="text-sm text-stone-500 tabular-nums sm:hidden">
            {formatDuration(service.duration_minutes)} · {formatPrice(service.price_czk)}
          </p>
        </div>
        <span className="hidden text-right text-sm text-stone-600 tabular-nums sm:block">
          {formatDuration(service.duration_minutes)}
        </span>
        <span className="hidden text-right text-sm font-semibold tabular-nums sm:block">{formatPrice(service.price_czk)}</span>
        <span className="text-right text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 group-open:hidden">Upravit</span>
        <span className="hidden text-right text-sm font-medium text-stone-500 group-open:inline">Zavřít</span>
      </summary>

      <div className="animate-[rise-in_220ms_var(--ease-out)] space-y-4 border-t border-edge p-4 motion-reduce:animate-none">
        <form action={updateAction} className="@container space-y-4">
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

        <form action={deleteAction} className="border-t border-edge pt-4">
          <input type="hidden" name="id" value={service.id} />
          <FormMessage state={deleteState} />
          <div className="mt-2">
            <ConfirmSubmit
              label="Smazat službu"
              question="Opravdu smazat? Službu se staršími rezervacemi raději jen skryjte."
              confirmLabel="Ano, smazat"
              pendingText="Mažu…"
            />
          </div>
        </form>
      </div>
    </details>
  );
}
