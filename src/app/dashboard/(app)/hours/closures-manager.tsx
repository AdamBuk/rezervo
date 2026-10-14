"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { ConfirmSubmit } from "@/components/confirm-submit";
import type { Closure } from "@/lib/database.types";
import { addClosure, deleteClosure } from "./closure-actions";

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { timeZone: "UTC", weekday: "short", day: "numeric", month: "numeric", year: "numeric" });

function formatRange(startsOn: string, endsOn: string) {
  const fmt = (d: string) => dateFormat.format(new Date(`${d}T00:00:00Z`));
  return startsOn === endsOn ? fmt(startsOn) : `${fmt(startsOn)} – ${fmt(endsOn)}`;
}

type ClosureRow = Pick<Closure, "id" | "starts_on" | "ends_on" | "note" | "staff_id">;
type StaffOption = { id: string; name: string };

function ClosureItem({ closure, staffName }: { closure: ClosureRow; staffName: string | null }) {
  const [state, action] = useActionState(deleteClosure, undefined);
  return (
    <li className="rounded-xl border border-edge bg-sand-50/60 px-4 py-2.5">
      <form action={action} className="flex flex-wrap items-center justify-between gap-3">
        <input type="hidden" name="id" value={closure.id} />
        <div className="min-w-0">
          <p className="font-medium tabular-nums first-letter:uppercase">{formatRange(closure.starts_on, closure.ends_on)}</p>
          <p className="truncate text-sm text-stone-500">
            {staffName ? `Volno: ${staffName}` : "Zavřený celý podnik"}
            {closure.note && ` · ${closure.note}`}
          </p>
        </div>
        <ConfirmSubmit
          label="Odebrat"
          question="Znovu otevřít pro rezervace?"
          confirmLabel="Ano, odebrat"
          pendingText="Odebírám…"
          className="btn-secondary px-3 py-1.5"
        />
      </form>
      <FormMessage state={state} />
    </li>
  );
}

export function ClosuresManager({ closures, staff, today }: { closures: ClosureRow[]; staff: StaffOption[]; today: string }) {
  const [state, formAction] = useActionState(addClosure, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    if (toRef.current) toRef.current.min = today;
  }, [state, today]);

  return (
    <div className="space-y-5">
      {closures.length > 0 ? (
        <ul className="space-y-2" aria-label="Naplánované zavírací dny">
          {closures.map((c) => (
            <ClosureItem key={c.id} closure={c} staffName={c.staff_id ? (staff.find((m) => m.id === c.staff_id)?.name ?? "neaktivní pracovník") : null} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300/80 p-4 text-sm text-stone-500">
          Žádné naplánované zavírací dny.
        </p>
      )}

      <form ref={formRef} action={formAction} className="space-y-3 rounded-xl border border-edge bg-sand-50/60 p-4">
        <h3 className="font-medium">Přidat zavírací dny</h3>
        {staff.length > 1 && (
          <div>
            <label htmlFor="closure-staff" className="label">
              Pro koho
            </label>
            <select id="closure-staff" name="staff_id" defaultValue="" className="input">
              <option value="">Celý podnik (zavřeno)</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (volno)
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="closure-from" className="label">
              Od
            </label>
            <input
              id="closure-from"
              name="starts_on"
              type="date"
              required
              min={today}
              onChange={(e) => {
                // "To" can't be before "from"
                if (toRef.current) toRef.current.min = e.target.value || today;
              }}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="closure-to" className="label">
              Do <span className="font-normal text-stone-400">(včetně, nepovinné)</span>
            </label>
            <input ref={toRef} id="closure-to" name="ends_on" type="date" min={today} className="input" />
          </div>
        </div>
        <div>
          <label htmlFor="closure-note" className="label">
            Poznámka <span className="font-normal text-stone-400">(vidíte jen vy)</span>
          </label>
          <input id="closure-note" name="note" maxLength={100} placeholder="např. Dovolená…" autoComplete="off" className="input" />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingText="Ukládám…">Přidat</SubmitButton>
      </form>
    </div>
  );
}
