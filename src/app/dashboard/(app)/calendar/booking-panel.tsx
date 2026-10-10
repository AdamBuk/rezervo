import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatPrice } from "@/lib/format";
import { formatInTimeZone, formatTime, minutesToTime, toZoned } from "@/lib/time";
import type { Business } from "@/lib/database.types";
import { BookingActions } from "./booking-actions";
import { DrawerShell } from "./drawer-shell";

type Props = { bookingId: string; business: Business; closeHref: string };

export async function BookingPanel({ bookingId, business, closeHref }: Props) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(bookingId);
  const supabase = await createClient();
  const { data: booking } = isUuid
    ? await supabase
        .from("bookings")
        .select("*, services(name, duration_minutes, price_czk)")
        .eq("id", bookingId)
        .eq("business_id", business.id)
        .maybeSingle()
    : { data: null };

  const tz = business.timezone;
  const local = booking ? toZoned(new Date(booking.starts_at), tz) : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link href={closeHref} scroll={false} aria-label="Zavřít detail" className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-stone-900/30 motion-reduce:animate-none" />
      <DrawerShell closeHref={closeHref} labelledBy="booking-title">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 id="booking-title" className="font-semibold">
            Detail rezervace
          </h2>
          <Link href={closeHref} scroll={false} className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Zavřít">
            ✕
          </Link>
        </div>

        {!booking || !local ? (
          <p className="p-5 text-stone-600">Rezervace nebyla nalezena.</p>
        ) : (
          <div className="space-y-6 p-5">
            <div>
              {booking.status === "cancelled" && (
                <p className="mb-3 inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Zrušeno</p>
              )}
              <p className="text-xl font-bold">{booking.services?.name}</p>
              <p className="mt-1 text-stone-600 first-letter:uppercase">
                {formatInTimeZone(booking.starts_at, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="text-stone-600 tabular-nums">
                {formatTime(booking.starts_at, tz)} – {formatTime(booking.ends_at, tz)}
                {booking.services && (
                  <>
                    {" "}
                    · {formatDuration(booking.services.duration_minutes)} · {formatPrice(booking.services.price_czk)}
                  </>
                )}
              </p>
            </div>

            <dl className="space-y-3 rounded-xl bg-sand-50 p-4 text-sm">
              <div>
                <dt className="text-stone-500">Zákazník</dt>
                <dd className="font-medium">{booking.customer_name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">E-mail</dt>
                <dd>
                  <a href={`mailto:${booking.customer_email}`} className="font-medium text-brand-700 hover:underline">
                    {booking.customer_email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Telefon</dt>
                <dd>
                  <a href={`tel:${booking.customer_phone.replace(/\s/g, "")}`} className="font-medium text-brand-700 hover:underline">
                    {booking.customer_phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Vytvořeno</dt>
                <dd>{formatInTimeZone(booking.created_at, tz, { dateStyle: "medium", timeStyle: "short" })}</dd>
              </div>
            </dl>

            {booking.status === "confirmed" && (
              <BookingActions
                bookingId={booking.id}
                defaultDate={local.date}
                defaultTime={minutesToTime(local.minutes)}
                stepMinutes={business.slot_step_minutes}
              />
            )}
          </div>
        )}
      </DrawerShell>
    </div>
  );
}
