"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { formatDuration, formatPrice } from "@/lib/format";
import { addDays, formatDateLong, formatInTimeZone, formatTime, isoWeekday } from "@/lib/time";
import { BOOKING_HORIZON_DAYS, WEEKDAYS } from "@/lib/constants";
import type { PublicBusiness } from "@/lib/availability";
import { isClosedOn, type DateRange } from "@/lib/slots";
import { createBooking, type BookingState } from "./actions";
import { AddToCalendar } from "./add-to-calendar";

type Props = {
  business: PublicBusiness["business"];
  services: PublicBusiness["services"];
  openWeekdays: number[];
  /** Upcoming closures (holidays), inclusive day ranges */
  closures: DateRange[];
  /** Today in the business timezone, computed on the server to avoid hydration drift */
  today: string;
};

type SlotsResult = { key: string; slots: string[]; nextAvailable: string | null } | { key: string; failed: true };

const DAYS_PER_PAGE = 7;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** First day of the 7-day page (counted from today) that contains `date`. */
function pageStartFor(today: string, date: string): string {
  return addDays(today, Math.floor(daysBetween(today, date) / DAYS_PER_PAGE) * DAYS_PER_PAGE);
}

/** Brings a step into view when it starts below the fold (mostly on phones). */
function revealStep(el: HTMLElement | null) {
  if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.6) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function BookingWidget(props: Props) {
  // Remounting the flow is the simplest way to start a fresh booking after success.
  const [round, setRound] = useState(0);
  return <BookingFlow key={round} {...props} onRestart={() => setRound((r) => r + 1)} />;
}

function BookingFlow({ business, services, openWeekdays, closures, today, onRestart }: Props & { onRestart: () => void }) {
  const [serviceId, setServiceId] = useState<string | null>(services.length === 1 ? services[0].id : null);
  const firstOpenDay = useMemo(() => {
    for (let i = 0; i <= BOOKING_HORIZON_DAYS; i++) {
      const d = addDays(today, i);
      if (openWeekdays.includes(isoWeekday(d)) && !isClosedOn(d, closures)) return d;
    }
    return today;
  }, [today, openWeekdays, closures]);
  const [date, setDate] = useState(firstOpenDay);
  // Whether the customer picked a day themselves; read in the fetch callback, so a ref (no refetch on change).
  const dateTouchedRef = useRef(false);
  const [pageStart, setPageStart] = useState(today);
  const [reloadKey, setReloadKey] = useState(0);
  // Results are tagged with the request key, so stale responses are ignored and
  // "loading" is simply "no result for the current key yet".
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [selection, setSelection] = useState<{ key: string; slot: string } | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const step2Ref = useRef<HTMLElement>(null);
  const step3Ref = useRef<HTMLElement>(null);

  const [state, formAction] = useActionState<BookingState, FormData>(async (prev, formData) => {
    const next = await createBooking(prev, formData);
    // Someone else took the slot in the meantime – refresh availability.
    if (next.status === "error" && next.slotTaken) setReloadKey((k) => k + 1);
    return next;
  }, { status: "idle" });

  const service = services.find((s) => s.id === serviceId);
  const requestKey = serviceId ? `${serviceId}|${date}|${reloadKey}` : null;
  const current = result && result.key === requestKey ? result : null;
  const slot = selection && selection.key === requestKey ? selection.slot : null;
  const lastBookableDay = addDays(today, BOOKING_HORIZON_DAYS);

  const goToDate = (d: string) => {
    dateTouchedRef.current = true;
    setDate(d);
    setPageStart(pageStartFor(today, d));
  };

  useEffect(() => {
    if (!requestKey || !serviceId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ slug: business.slug, service: serviceId, date });
    fetch(`/api/slots?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { slots: string[]; nextAvailable: string | null }) => {
        // Until the customer picks a day, skip straight to the nearest day with free times.
        if (!dateTouchedRef.current && data.slots.length === 0 && data.nextAvailable) {
          setDate(data.nextAvailable);
          setPageStart(pageStartFor(today, data.nextAvailable));
          return;
        }
        setResult({ key: requestKey, slots: data.slots, nextAvailable: data.nextAvailable });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: requestKey, failed: true });
      });
    return () => controller.abort();
  }, [business.slug, serviceId, date, requestKey, today]);

  if (state.status === "success") {
    return (
      <div className="card animate-[rise-in_260ms_var(--ease-out)] text-center motion-reduce:animate-[fade-in_150ms_ease-out]" role="status">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold">Rezervace je potvrzená</h2>
        <p className="mt-2 text-stone-600">
          <strong className="text-stone-900">{state.serviceName}</strong>
          <br />
          <span className="first-letter:uppercase">
            {formatInTimeZone(state.startsAt, business.timezone, { weekday: "long", day: "numeric", month: "long" })} v{" "}
            {formatTime(state.startsAt, business.timezone)}
          </span>
          {business.address && (
            <>
              <br />
              <span className="text-sm">{business.address}</span>
            </>
          )}
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Potvrzení jsme poslali na <strong className="break-all">{state.email}</strong>. Den předem vám pošleme připomínku.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <AddToCalendar
            uid={state.bookingId}
            title={`${state.serviceName} – ${business.name}`}
            startsAt={state.startsAt}
            durationMinutes={state.durationMinutes}
            location={business.address}
            description={business.phone ? `Změna termínu: ${business.phone}` : undefined}
          />
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold">
            {state.managePath && (
              <a href={state.managePath} className="text-stone-600 hover:text-stone-900 hover:underline">
                Zobrazit nebo zrušit rezervaci
              </a>
            )}
            <button type="button" onClick={onRestart} className="text-brand-700 hover:underline">
              Vytvořit další rezervaci
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return <div className="card text-stone-600">Tento podnik zatím nenabízí žádné služby k online rezervaci.</div>;
  }

  const days = Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(pageStart, i));

  return (
    <div className="space-y-4">
      {/* Step 1: service */}
      <section className="card" aria-labelledby="step-1">
        <StepTitle id="step-1" n={1} done={Boolean(service)}>
          Vyberte službu
        </StepTitle>
        <div className="stagger mt-3 grid gap-2 sm:grid-cols-2">
          {services.map((s) => {
            const selected = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setServiceId(s.id);
                  requestAnimationFrame(() => revealStep(step2Ref.current));
                }}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] motion-reduce:active:scale-100 ${
                  selected
                    ? "border-brand-600 bg-brand-50/90 shadow-(--shadow-glass) ring-1 ring-brand-600"
                    : "border-edge/80 bg-surface/55 hover:border-brand-200 hover:bg-surface/90 hover:shadow-xs"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  {s.description && <span className="block truncate text-sm text-stone-500">{s.description}</span>}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block font-semibold tabular-nums">{formatPrice(s.price_czk)}</span>
                  <span className="block text-stone-500">{formatDuration(s.duration_minutes)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: day and time */}
      <section
        ref={step2Ref}
        aria-labelledby="step-2"
        className={`card scroll-mt-4 transition-opacity ${service ? "" : "opacity-50"}`}
        inert={!service}
      >
        <div className="flex items-center justify-between gap-2">
          <StepTitle id="step-2" n={2} done={Boolean(slot)}>
            Vyberte termín
          </StepTitle>
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

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const weekday = WEEKDAYS[isoWeekday(d) - 1];
            const holiday = isClosedOn(d, closures);
            const closed = !openWeekdays.includes(weekday.iso) || holiday || d > lastBookableDay;
            const selected = d === date;
            return (
              <button
                key={d}
                type="button"
                disabled={closed}
                aria-pressed={selected}
                aria-label={`${formatDateLong(d)}${holiday ? " – dovolená" : closed ? " – zavřeno" : ""}`}
                title={holiday ? "Zavřeno (dovolená)" : undefined}
                onClick={() => goToDate(d)}
                className={`rounded-lg border px-1 py-2 text-center text-sm transition-[color,background-color,border-color,transform] duration-150 ease-(--ease-out) focus-visible:outline-2 enabled:active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  selected
                    ? "border-accent-strong bg-accent-strong text-white"
                    : closed
                      ? "cursor-not-allowed border-transparent bg-stone-100/50 text-stone-300"
                      : "border-edge/80 bg-surface/55 hover:border-brand-300 hover:bg-surface"
                }`}
              >
                <span className="block text-xs font-medium uppercase">{weekday.short}</span>
                <span className="block font-semibold">{Number(d.slice(8))}.</span>
                {d === today && <span className={`mx-auto mt-0.5 block size-1 rounded-full ${selected ? "bg-white" : "bg-brand-600"}`} aria-hidden />}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-medium first-letter:uppercase">{formatDateLong(date)}</p>
        <div className="mt-2 min-h-12" aria-live="polite">
          {!service ? null : !current ? (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-7" aria-label="Načítám volné termíny">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-surface/60" />
              ))}
            </div>
          ) : "failed" in current ? (
            <p className="text-sm text-red-700">
              Volné termíny se nepodařilo načíst.{" "}
              <button type="button" className="font-semibold underline" onClick={() => setReloadKey((k) => k + 1)}>
                Zkusit znovu
              </button>
            </p>
          ) : current.slots.length === 0 ? (
            <div className="rounded-xl border border-edge/70 bg-surface/50 px-4 py-3 text-sm text-stone-600">
              <p>V tento den už nejsou volné termíny.</p>
              {current.nextAvailable ? (
                <button
                  type="button"
                  onClick={() => goToDate(current.nextAvailable!)}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                >
                  Nejbližší volný termín: <span className="first-letter:uppercase">{formatDateLong(current.nextAvailable)}</span> →
                </button>
              ) : (
                <p className="mt-1">Zkuste prosím jiný týden, nebo podnik kontaktujte telefonicky.</p>
              )}
            </div>
          ) : (
            <div key={requestKey} className="grid animate-[rise-in_220ms_var(--ease-out)] grid-cols-4 gap-1.5 motion-reduce:animate-[fade-in_150ms_ease-out] sm:grid-cols-6 md:grid-cols-7">
              {current.slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === slot}
                  onClick={() => {
                    if (!requestKey) return;
                    setSelection({ key: requestKey, slot: s });
                    requestAnimationFrame(() => revealStep(step3Ref.current));
                  }}
                  className={`rounded-lg border py-2 text-sm font-medium tabular-nums transition-[color,background-color,border-color,transform] duration-150 ease-(--ease-out) focus-visible:outline-2 active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                    s === slot
                      ? "border-accent-strong bg-accent-strong text-white shadow-(--shadow-brand)"
                      : "border-edge/80 bg-surface/60 hover:border-brand-300 hover:bg-surface"
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
      <section
        ref={step3Ref}
        aria-labelledby="step-3"
        className={`card scroll-mt-4 transition-opacity ${slot ? "" : "opacity-50"}`}
        inert={!slot}
      >
        <StepTitle id="step-3" n={3} done={false}>
          Vaše údaje
        </StepTitle>
        <form action={formAction} className="mt-3 space-y-4">
          <input type="hidden" name="slug" value={business.slug} />
          <input type="hidden" name="service_id" value={serviceId ?? ""} />
          <input type="hidden" name="starts_at" value={slot ?? ""} />
          <div className="hidden" aria-hidden>
            <label>
              Web <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
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
            <div>
              <label htmlFor="email" className="label">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                spellCheck={false}
                autoCapitalize="none"
                inputMode="email"
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
                inputMode="tel"
                required
                autoComplete="tel"
                placeholder="+420 777 123 456"
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
            <div className="flex animate-[rise-in_220ms_var(--ease-out)] flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm motion-reduce:animate-none">
              <span>
                <span className="font-semibold">{service.name}</span> ·{" "}
                <span className="first-letter:uppercase">
                  {formatInTimeZone(slot, business.timezone, { weekday: "short", day: "numeric", month: "numeric" })}
                </span>{" "}
                v {formatTime(slot, business.timezone)}
              </span>
              <span className="font-semibold tabular-nums">{formatPrice(service.price_czk)}</span>
            </div>
          )}

          <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="Odesílám…" disabled={!slot}>
            Závazně rezervovat
          </SubmitButton>
          <p className="text-center text-xs text-stone-400">Vaše údaje použijeme jen pro vyřízení této rezervace.</p>
        </form>
      </section>
    </div>
  );
}

function StepTitle({ id, n, done, children }: { id: string; n: number; done: boolean; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-lg font-semibold">
      <span
        className={`grid size-7 place-items-center rounded-full text-sm font-bold transition-colors ${
          done ? "bg-accent-strong text-white" : "bg-brand-100 text-brand-800"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      {children}
      {done && <span className="sr-only">(hotovo)</span>}
    </h2>
  );
}
