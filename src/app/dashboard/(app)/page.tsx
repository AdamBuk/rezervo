import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDateLong,
  isValidDateString,
  formatInTimeZone,
  formatTime,
  startOfWeek,
  todayInTimeZone,
  toZoned,
  zonedTimeToUtc,
} from "@/lib/time";
import { formatPrice } from "@/lib/format";
import { CalendarGrid, type CalendarBooking } from "./calendar/calendar-grid";
import { BookingPanel } from "./calendar/booking-panel";

export const metadata: Metadata = { title: "Kalendář" };

export type CalendarView = "day" | "week";

export default async function CalendarPage({ searchParams }: PageProps<"/dashboard">) {
  const business = await requireBusiness();
  const params = await searchParams;

  const view: CalendarView = params.view === "day" ? "day" : "week";
  const today = todayInTimeZone(business.timezone);
  const requested = typeof params.date === "string" && isValidDateString(params.date) ? params.date : today;
  const rangeStart = view === "week" ? startOfWeek(requested) : requested;
  const dayCount = view === "week" ? 7 : 1;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(rangeStart, i));
  const bookingId = typeof params.booking === "string" ? params.booking : null;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: bookings }, { data: hours }, { data: upcoming }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, starts_at, ends_at, customer_name, customer_phone, services(name, price_czk)")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gte("starts_at", zonedTimeToUtc(rangeStart, 0, business.timezone).toISOString())
      .lt("starts_at", zonedTimeToUtc(addDays(rangeStart, dayCount), 0, business.timezone).toISOString())
      .order("starts_at"),
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("business_id", business.id),
    supabase
      .from("bookings")
      .select("id, starts_at, customer_name, services(name)")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gt("ends_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);

  const href = (overrides: Record<string, string | null>) => {
    const sp = new URLSearchParams({ view, date: requested });
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    return `/dashboard?${sp}`;
  };

  const step = view === "week" ? 7 : 1;
  const title =
    view === "week"
      ? `${formatShort(days[0])} – ${formatShort(days[6])}`
      : formatDateLong(requested).replace(/^./, (c) => c.toUpperCase());

  const calendarBookings: CalendarBooking[] = (bookings ?? []).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    customerName: b.customer_name,
    serviceName: b.services?.name ?? "",
  }));

  const revenue = (bookings ?? []).reduce((sum, b) => sum + (b.services?.price_czk ?? 0), 0);
  const now = toZoned(new Date(), business.timezone);
  const periodLabel = view === "week" ? "tento týden" : "tento den";
  const upcomingHref = upcoming
    ? `/dashboard?${new URLSearchParams({ view: "day", date: toZoned(new Date(upcoming.starts_at), business.timezone).date, booking: upcoming.id })}`
    : null;

  return (
    <div className="space-y-3">
      {params.password === "changed" && (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800" role="status">
          Heslo bylo změněno.
        </p>
      )}
      <dl className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="glass rounded-2xl px-4 py-3">
          <dt className="text-xs font-medium text-stone-500">Rezervace · {periodLabel}</dt>
          <dd className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{calendarBookings.length}</dd>
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <dt className="text-xs font-medium text-stone-500">Očekávaná tržba · {periodLabel}</dt>
          <dd className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{formatPrice(revenue)}</dd>
        </div>
        <div className="glass col-span-2 rounded-2xl px-4 py-3 sm:col-span-1">
          <dt className="text-xs font-medium text-stone-500">Nejbližší zákazník</dt>
          <dd className="mt-1 min-w-0">
            {upcoming && upcomingHref ? (
              <Link href={upcomingHref} className="group block min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-brand-600">
                <span className="block truncate font-semibold group-hover:text-brand-700">{upcoming.customer_name}</span>
                <span className="block truncate text-sm text-stone-500 first-letter:uppercase">
                  {formatInTimeZone(upcoming.starts_at, business.timezone, { weekday: "short", day: "numeric", month: "numeric" })}{" "}
                  v {formatTime(upcoming.starts_at, business.timezone)}
                  {upcoming.services?.name ? ` · ${upcoming.services.name}` : ""}
                </span>
              </Link>
            ) : (
              <span className="text-sm text-stone-500">Žádné nadcházející rezervace</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href({ date: addDays(requested, -step), booking: null })} className="btn-secondary px-2.5" aria-label="Předchozí">
            ←
          </Link>
          <Link href={href({ date: today, booking: null })} className="btn-secondary">
            Dnes
          </Link>
          <Link href={href({ date: addDays(requested, step), booking: null })} className="btn-secondary px-2.5" aria-label="Další">
            →
          </Link>
          <h2 className="ml-2 text-lg font-semibold">{title}</h2>
        </div>
        <div className="glass inline-flex rounded-xl p-1 text-sm" role="group" aria-label="Zobrazení">
          {(["day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v, booking: null })}
              aria-current={view === v ? "page" : undefined}
              className={`rounded-lg px-3 py-1 font-medium transition-[color,background-color,box-shadow] duration-200 ${view === v ? "bg-white text-brand-800 shadow-(--shadow-glass)" : "text-stone-600 hover:bg-white/60"}`}
            >
              {v === "day" ? "Den" : "Týden"}
            </Link>
          ))}
        </div>
      </div>

      {calendarBookings.length === 0 && <p className="text-sm text-stone-500">V tomto období nemáte žádné rezervace.</p>}

      <CalendarGrid
        days={days}
        today={today}
        timeZone={business.timezone}
        bookings={calendarBookings}
        hours={hours ?? []}
        now={now}
        bookingHref={(id) => href({ booking: id })}
        dayHref={(date) => `/dashboard?${new URLSearchParams({ view: "day", date })}`}
        selectedId={bookingId}
      />

      {bookingId && <BookingPanel bookingId={bookingId} business={business} closeHref={href({ booking: null })} />}
    </div>
  );
}

const shortDate = new Intl.DateTimeFormat("cs-CZ", { timeZone: "UTC", day: "numeric", month: "numeric" });

/** "2026-10-14" → "14. 10." (calendar date, timezone-independent) */
function formatShort(date: string) {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}
