import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDateLong,
  isValidDateString,
  isoWeekday,
  formatInTimeZone,
  formatTime,
  startOfWeek,
  todayInTimeZone,
  toZoned,
  zonedTimeToUtc,
} from "@/lib/time";
import { formatPrice } from "@/lib/format";
import { WEEKDAYS } from "@/lib/constants";
import { isUuid } from "@/lib/validation";
import { CalendarGrid, type CalendarBooking, type CalendarColumn } from "./calendar/calendar-grid";
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
  const staffFilter = typeof params.staff === "string" && isUuid(params.staff) ? params.staff : null;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  let bookingsQuery = supabase
    .from("bookings")
    .select("id, starts_at, ends_at, customer_name, customer_phone, staff_id, services(name, price_czk)")
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .gte("starts_at", zonedTimeToUtc(rangeStart, 0, business.timezone).toISOString())
    .lt("starts_at", zonedTimeToUtc(addDays(rangeStart, dayCount), 0, business.timezone).toISOString())
    .order("starts_at");
  let upcomingQuery = supabase
    .from("bookings")
    .select("id, starts_at, customer_name, services(name)")
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .gt("ends_at", nowIso);
  if (staffFilter) {
    bookingsQuery = bookingsQuery.eq("staff_id", staffFilter);
    upcomingQuery = upcomingQuery.eq("staff_id", staffFilter);
  }
  const [{ data: bookings }, { data: hours }, { data: upcoming }, { data: staff }, { data: staffLeave }] = await Promise.all([
    bookingsQuery,
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("business_id", business.id),
    upcomingQuery.order("starts_at").limit(1).maybeSingle(),
    supabase
      .from("staff")
      .select("id, name, is_active, uses_business_hours, staff_hours(weekday, opens_at, closes_at)")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("closures")
      .select("staff_id, starts_on, ends_on")
      .eq("business_id", business.id)
      .not("staff_id", "is", null)
      .lte("starts_on", addDays(rangeStart, dayCount - 1))
      .gte("ends_on", rangeStart),
  ]);

  const allStaff = staff ?? [];
  const staffName = (id: string) => allStaff.find((m) => m.id === id)?.name ?? "";
  // Inactive staff still get a column while they have bookings in view.
  const visibleStaff = allStaff.filter(
    (m) => (staffFilter === null || m.id === staffFilter) && (m.is_active || (bookings ?? []).some((b) => b.staff_id === m.id)),
  );
  const isTeam = allStaff.filter((m) => m.is_active).length > 1;
  /** A staff member's shift on a day: undefined = opening hours, null = day off */
  const shiftOf = (staffId: string | null, date: string) => {
    const member = staffId ? allStaff.find((m) => m.id === staffId) : undefined;
    if (!member) return undefined;
    const onLeave = (staffLeave ?? []).some((c) => c.staff_id === member.id && c.starts_on <= date && date <= c.ends_on);
    if (onLeave) return null;
    if (member.uses_business_hours) return undefined;
    return member.staff_hours.find((h) => h.weekday === isoWeekday(date)) ?? null;
  };

  const href = (overrides: Record<string, string | null>) => {
    const sp = new URLSearchParams({ view, date: requested });
    if (staffFilter) sp.set("staff", staffFilter);
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
    staffId: b.staff_id,
    staffName: staffName(b.staff_id),
  }));

  const dayHref = (date: string) => {
    const sp = new URLSearchParams({ view: "day", date });
    if (staffFilter) sp.set("staff", staffFilter);
    return `/dashboard?${sp}`;
  };
  // Day view of a team: one column per staff member. Otherwise one column per day.
  const columns: CalendarColumn[] =
    view === "day" && visibleStaff.length > 1
      ? visibleStaff.map((m) => ({
          key: m.id,
          date: requested,
          label: m.is_active ? m.name : `${m.name} (neaktivní)`,
          href: href({ staff: m.id, booking: null }),
          highlight: false,
          opening: shiftOf(m.id, requested),
          match: (b) => b.staffId === m.id,
        }))
      : days.map((d) => {
          const [, month, day] = d.split("-").map(Number);
          const weekday = WEEKDAYS[isoWeekday(d) - 1];
          return {
            key: d,
            date: d,
            label: view === "week" ? weekday.short : weekday.label,
            badge: `${day}. ${month}.`,
            href: dayHref(d),
            highlight: d === today,
            opening: shiftOf(staffFilter, d),
            match: () => true,
          };
        });

  const revenue = (bookings ?? []).reduce((sum, b) => sum + (b.services?.price_czk ?? 0), 0);
  const now = toZoned(new Date(), business.timezone);
  const periodLabel = view === "week" ? "tento týden" : "tento den";
  const upcomingHref = upcoming
    ? `/dashboard?${new URLSearchParams({ view: "day", date: toZoned(new Date(upcoming.starts_at), business.timezone).date, booking: upcoming.id })}`
    : null;

  return (
    <div className="space-y-6">
      {params.password === "changed" && (
        <p className="rounded-2xl bg-sage-100 px-5 py-3.5 font-semibold text-sage-700" role="status">
          Heslo bylo změněno.
        </p>
      )}
      <dl className="stagger grid grid-cols-2 gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
        <div className="rounded-2xl bg-blush-100 p-5 sm:p-6">
          <dt className="text-sm font-semibold text-stone-700">Rezervace · {periodLabel}</dt>
          <dd className="headline mt-2 text-4xl tabular-nums sm:text-5xl">{calendarBookings.length}</dd>
        </div>
        <div className="rounded-2xl bg-sage-100 p-5 sm:p-6">
          <dt className="text-sm font-semibold text-stone-700">Očekávaná tržba · {periodLabel}</dt>
          <dd className="headline mt-2 text-4xl tabular-nums sm:text-5xl">{formatPrice(revenue)}</dd>
        </div>
        <div className="col-span-2 rounded-2xl bg-butter-100 p-5 sm:p-6 lg:col-span-1">
          <dt className="text-sm font-semibold text-stone-700">Nejbližší zákazník</dt>
          <dd className="mt-2 min-w-0">
            {upcoming && upcomingHref ? (
              <Link href={upcomingHref} className="group block min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-600">
                <span className="block truncate font-display text-2xl font-bold tracking-tight underline decoration-transparent decoration-2 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-brand-400">
                  {upcoming.customer_name}
                </span>
                <span className="mt-1 block truncate text-stone-700 first-letter:uppercase">
                  {formatInTimeZone(upcoming.starts_at, business.timezone, { weekday: "short", day: "numeric", month: "numeric" })}{" "}
                  v {formatTime(upcoming.starts_at, business.timezone)}
                  {upcoming.services?.name ? ` · ${upcoming.services.name}` : ""}
                </span>
              </Link>
            ) : (
              <span className="text-stone-600">Žádné nadcházející rezervace</span>
            )}
          </dd>
        </div>
      </dl>

      {isTeam && (
        <nav aria-label="Filtr pracovníků" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <ul className="inline-flex min-w-max gap-1.5">
            {[{ id: null, name: "Celý tým" }, ...allStaff.filter((m) => m.is_active || m.id === staffFilter)].map((m) => {
              const active = staffFilter === m.id;
              return (
                <li key={m.id ?? "all"}>
                  <Link
                    href={href({ staff: m.id, booking: null })}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-[color,background-color,border-color] duration-150 ${
                      active ? "border-ink bg-ink text-on-ink" : "border-edge bg-surface text-stone-600 hover:border-stone-300 hover:text-stone-900"
                    }`}
                  >
                    {m.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href({ date: addDays(requested, -step), booking: null })} className="btn-secondary size-11 p-0" aria-label="Předchozí">
            ←
          </Link>
          <Link href={href({ date: today, booking: null })} className="btn-secondary">
            Dnes
          </Link>
          <Link href={href({ date: addDays(requested, step), booking: null })} className="btn-secondary size-11 p-0" aria-label="Další">
            →
          </Link>
          <h2 className="headline ml-2 text-2xl sm:text-3xl">{title}</h2>
        </div>
        <div className="inline-flex rounded-full border border-edge bg-surface p-1 shadow-(--shadow-panel)" role="group" aria-label="Zobrazení">
          {(["day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v, booking: null })}
              aria-current={view === v ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 font-semibold transition-[color,background-color,box-shadow] duration-200 ${view === v ? "bg-ink text-on-ink" : "text-stone-600 hover:bg-sand-100 hover:text-stone-900"}`}
            >
              {v === "day" ? "Den" : "Týden"}
            </Link>
          ))}
        </div>
      </div>

      {calendarBookings.length === 0 && <p className="text-sm text-stone-500">V tomto období nemáte žádné rezervace.</p>}

      <CalendarGrid
        columns={columns}
        timeZone={business.timezone}
        bookings={calendarBookings}
        hours={hours ?? []}
        now={now}
        bookingHref={(id) => href({ booking: id })}
        selectedId={bookingId}
        showStaff={isTeam && staffFilter === null && view === "week"}
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
