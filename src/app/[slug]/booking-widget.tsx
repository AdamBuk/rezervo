"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { formatDuration, formatPrice } from "@/lib/format";
import { addDays, formatDateLong, formatInTimeZone, formatTime, isoWeekday } from "@/lib/time";
import { BOOKING_HORIZON_DAYS, WEEKDAYS } from "@/lib/constants";
import type { PublicBusiness } from "@/lib/availability";
import { createBooking, type BookingState } from "./actions";

type Props = {
  business: PublicBusiness["business"];
  services: PublicBusiness["services"];
  openWeekdays: number[];
  /** Today in the business timezone, computed on the server to avoid hydration drift */
  today: string;
};

type SlotsState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; slots: string[] };

const DAYS_PER_PAGE = 7;

export function BookingWidget({ business, services, openWeekdays, today }: Props) {
  const [serviceId, setServiceId] = useState<string | null>(services.length === 1 ? services[0].id : null);
  const firstOpenDay = useMemo(() => {
    for (let i = 0; i <= BOOKING_HORIZON_DAYS; i++) {
      const d = addDays(today, i);
      if (openWeekdays.includes(isoWeekday(d))) return d;
    }
    return today;
  }, [today, openWeekdays]);
  const [date, setDate] = useState(firstOpenDay);
  const [pageStart, setPageStart] = useState(today);
  const [reloadKey, setReloadKey] = useState(0);
  // Results are tagged with the request key, so stale responses are ignored and
  // "loading" is simply "no result for the current key yet".
  const [result, setResult] = useState<{ key: string; slots: string[] | null } | null>(null);
  const [selection, setSelection] = useState<{ key: string; slot: string } | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

  const [state, formAction] = useActionState<BookingState, FormData>(async (prev, formData) => {
    const next = await createBooking(prev, formData);
    // Someone else took the slot in the meantime – refresh availability.
    if (next.status === "error" && next.slotTaken) setReloadKey((k) => k + 1);
    return next;
  }, { status: "idle" });

  const service = services.find((s) => s.id === serviceId);
  const requestKey = serviceId ? `${serviceId}|${date}|${reloadKey}` : null;
  const slotsState: SlotsState = !requestKey
    ? { status: "idle" }
    : result?.key !== requestKey
      ? { status: "loading" }
      : result.slots
        ? { status: "ready", slots: result.slots }
        : { status: "error" };
  const slot = selection && selection.key === requestKey ? selection.slot : null;

  useEffect(() => {
    if (!requestKey || !serviceId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ slug: business.slug, service: serviceId, date });
    fetch(`/api/slots?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { slots: string[] }) => setResult({ key: requestKey, slots: data.slots }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: requestKey, slots: null });
      });
    return () => controller.abort();
  }, [business.slug, serviceId, date, requestKey]);

  if (state.status === "success") {
    return (
      <div className="card text-center" role="status">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-100 text-2xl text-brand-700">✓</div>
        <h2 className="mt-4 text-xl font-bold">Rezervace je potvrzená</h2>
        <p className="mt-2 text-stone-600">
          <strong className="text-stone-900">{state.serviceName}</strong>
          <br />
          {formatInTimeZone(state.startsAt, business.timezone, { weekday: "long", day: "numeric", month: "long" })} v{" "}
          {formatTime(state.startsAt, business.timezone)}
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Potvrzení jsme poslali na <strong>{state.email}</strong>. Den předem vám pošleme připomínku.
        </p>
      </div>
    );
  }

  if (services.length === 0) {
    return <div className="card text-stone-600">Tento podnik zatím nenabízí žádné služby k online rezervaci.</div>;
  }

  const days = Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(pageStart, i));
  const lastBookableDay = addDays(today, BOOKING_HORIZON_DAYS);

  return (
    <div className="space-y-6">
      {/* Step 1: service */}
      <section className="card">
        <StepTitle n={1}>Vyberte službu</StepTitle>
        <div className="mt-4 grid gap-2">
          {services.map((s) => {
            const selected = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setServiceId(s.id)}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{s.name}</span>
                  {s.description && <span className="block text-sm text-stone-500">{s.description}</span>}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block font-semibold">{formatPrice(s.price_czk)}</span>
                  <span className="block text-stone-500">{formatDuration(s.duration_minutes)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: day and time */}
      <section className={`card ${service ? "" : "opacity-50"}`} inert={!service}>
        <div className="flex items-center justify-between gap-2">
          <StepTitle n={2}>Vyberte termín</StepTitle>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5"
              aria-label="Předchozí týden"
              disabled={pageStart <= today}
              onClick={() => setPageStart(addDays(pageStart, -DAYS_PER_PAGE))}
            >
              ←
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5"
              aria-label="Další týden"
              disabled={addDays(pageStart, DAYS_PER_PAGE) > lastBookableDay}
              onClick={() => setPageStart(addDays(pageStart, DAYS_PER_PAGE))}
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const weekday = WEEKDAYS[isoWeekday(d) - 1];
            const closed = !openWeekdays.includes(weekday.iso) || d > lastBookableDay;
            const selected = d === date;
            return (
              <button
                key={d}
                type="button"
                disabled={closed}
                aria-pressed={selected}
                onClick={() => setDate(d)}
                className={`rounded-lg border px-1 py-2 text-center text-sm transition-colors ${
                  selected
                    ? "border-brand-700 bg-brand-700 text-white"
                    : closed
                      ? "cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300"
                      : "border-stone-200 hover:border-brand-400"
                }`}
              >
                <span className="block text-xs font-medium uppercase">{weekday.short}</span>
                <span className="block font-semibold">{Number(d.slice(8))}.</span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-sm font-medium first-letter:uppercase">{formatDateLong(date)}</p>
        <div className="mt-2 min-h-12">
          {!service ? null : slotsState.status !== "ready" && slotsState.status !== "error" ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Načítám volné termíny">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-stone-100" />
              ))}
            </div>
          ) : slotsState.status === "error" ? (
            <p className="text-sm text-red-700">
              Volné termíny se nepodařilo načíst.{" "}
              <button type="button" className="font-semibold underline" onClick={() => setReloadKey((k) => k + 1)}>
                Zkusit znovu
              </button>
            </p>
          ) : slotsState.slots.length === 0 ? (
            <p className="text-sm text-stone-500">V tento den už nejsou volné termíny. Zkuste jiný den.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slotsState.slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === slot}
                  onClick={() => requestKey && setSelection({ key: requestKey, slot: s })}
                  className={`rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors ${
                    s === slot
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-stone-200 hover:border-brand-400 hover:bg-brand-50"
                  }`}
                >
                  {formatTime(s, business.timezone)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Step 3: contact details */}
      <section className={`card ${slot ? "" : "opacity-50"}`} inert={!slot}>
        <StepTitle n={3}>Vaše údaje</StepTitle>
        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="slug" value={business.slug} />
          <input type="hidden" name="service_id" value={serviceId ?? ""} />
          <input type="hidden" name="starts_at" value={slot ?? ""} />
          <div className="hidden" aria-hidden>
            <label>
              Web <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div>
            <label htmlFor="name" className="label">
              Jméno a příjmení
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="input"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Telefon
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                pattern="\+?[\d\s\(\)\-]{6,30}"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {state.status === "error" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {state.error}
            </p>
          )}

          {service && slot && (
            <div className="rounded-lg bg-sand-100 px-4 py-3 text-sm">
              <span className="font-semibold">{service.name}</span> ·{" "}
              {formatInTimeZone(slot, business.timezone, { weekday: "short", day: "numeric", month: "numeric" })} v{" "}
              {formatTime(slot, business.timezone)} · {formatPrice(service.price_czk)}
            </div>
          )}

          <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="Odesílám…" disabled={!slot}>
            Závazně rezervovat
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-semibold">
      <span className="grid size-7 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{n}</span>
      {children}
    </h2>
  );
}
