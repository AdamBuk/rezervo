import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDateLong,
  isValidDateString,
  startOfWeek,
  todayInTimeZone,
  zonedTimeToUtc,
} from "@/lib/time";
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
  const [{ data: bookings }, { data: hours }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, starts_at, ends_at, customer_name, customer_phone, services(name)")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gte("starts_at", zonedTimeToUtc(rangeStart, 0, business.timezone).toISOString())
      .lt("starts_at", zonedTimeToUtc(addDays(rangeStart, dayCount), 0, business.timezone).toISOString())
      .order("starts_at"),
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("business_id", business.id),
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

  return (
    <div className="space-y-4">
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
        <div className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm" role="group" aria-label="Zobrazení">
          {(["day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v, booking: null })}
              aria-current={view === v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium ${view === v ? "bg-brand-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {v === "day" ? "Den" : "Týden"}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-stone-500">
        {calendarBookings.length === 0
          ? "V tomto období nemáte žádné rezervace."
          : `${calendarBookings.length} ${pluralBookings(calendarBookings.length)} v tomto období.`}
      </p>

      <CalendarGrid
        days={days}
        today={today}
        timeZone={business.timezone}
        bookings={calendarBookings}
        hours={hours ?? []}
        bookingHref={(id) => href({ booking: id })}
        dayHref={(date) => `/dashboard?${new URLSearchParams({ view: "day", date })}`}
        selectedId={bookingId}
      />

      {bookingId && <BookingPanel bookingId={bookingId} business={business} closeHref={href({ booking: null })} />}
    </div>
  );
}

function formatShort(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${d}. ${m}.`;
}

function pluralBookings(n: number) {
  return n <= 4 ? "rezervace" : "rezervací";
}
