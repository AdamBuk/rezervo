import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingLinkSecret, verifyBookingManageToken } from "@/lib/booking-link";
import { isUuid } from "@/lib/validation";
import { CUSTOMER_CANCEL_NOTICE_HOURS } from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";
import { formatInTimeZone, formatTime } from "@/lib/time";
import { CancelOwnBooking } from "./cancel-own-booking";

export const metadata: Metadata = {
  title: "Vaše rezervace",
  // Personal page behind a secret link: keep it out of search engines and Referer headers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ManageBookingPage({ params }: PageProps<"/rezervace/[id]/[token]">) {
  const { id: rawId, token } = await params;
  const id = rawId.toLowerCase();
  if (!isUuid(id) || !verifyBookingManageToken(id, token, getBookingLinkSecret())) notFound();

  const { data: booking, error } = await createAdminClient()
    .from("bookings")
    .select("id, status, starts_at, ends_at, customer_name, services(name, duration_minutes, price_czk), businesses(name, slug, address, phone, timezone)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!booking || !booking.businesses) notFound();

  const business = booking.businesses;
  const tz = business.timezone;
  const startsAt = new Date(booking.starts_at);
  const { isPast, canCancel } = timing(startsAt, booking.status);
  const phoneHref = business.phone ? `tel:${business.phone.replace(/\s/g, "")}` : null;

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-lg flex-1 px-4 py-10 outline-none sm:py-16">
      <p className="text-sm font-medium text-brand-700">Vaše rezervace</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{business.name}</h1>

      <section className="card mt-6" aria-labelledby="booking-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="booking-heading" className="text-lg font-semibold">
              {booking.services?.name ?? "Rezervace"}
            </h2>
            <p className="mt-1 text-stone-600 first-letter:uppercase">
              {formatInTimeZone(startsAt, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
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
          <StatusBadge status={booking.status} isPast={isPast} />
        </div>

        <dl className="mt-4 space-y-2 rounded-xl border border-edge/80 bg-surface/60 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Jméno</dt>
            <dd className="min-w-0 truncate font-medium">{booking.customer_name}</dd>
          </div>
          {business.address && (
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Adresa</dt>
              <dd className="text-right font-medium">{business.address}</dd>
            </div>
          )}
          {business.phone && phoneHref && (
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Telefon</dt>
              <dd>
                <a href={phoneHref} className="font-medium text-brand-700 hover:underline">
                  {business.phone}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6">
          {canCancel ? (
            <CancelOwnBooking bookingId={booking.id} token={token} bookAgainHref={`/${business.slug}`} />
          ) : booking.status === "cancelled" ? (
            <div className="rounded-xl bg-sand-100 px-4 py-3 text-sm text-stone-700" role="status">
              <p className="font-semibold text-stone-900">Rezervace je zrušená.</p>
              <p className="mt-1">Termín je znovu volný. Potvrzení o zrušení najdete v e-mailu.</p>
              <Link href={`/${business.slug}`} className="mt-2 inline-block font-semibold text-brand-700 hover:underline">
                Vybrat nový termín →
              </Link>
            </div>
          ) : isPast ? (
            <p className="text-sm text-stone-600">Tento termín už proběhl. Děkujeme za návštěvu!</p>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Do termínu zbývá méně než {CUSTOMER_CANCEL_NOTICE_HOURS} hodiny, online už ho zrušit nelze.
              {phoneHref ? (
                <>
                  {" "}
                  Zavolejte prosím na{" "}
                  <a href={phoneHref} className="font-semibold underline">
                    {business.phone}
                  </a>
                  .
                </>
              ) : (
                " Kontaktujte prosím podnik."
              )}
            </p>
          )}
        </div>
      </section>

      <footer className="mt-8 flex flex-col items-center gap-3 text-xs text-stone-400">
        <p>
          Rezervace přes{" "}
          <Link href="/" className="font-semibold hover:text-stone-600">
            Rezervo
          </Link>
        </p>
        <ThemeToggle />
      </footer>
    </main>
  );
}

/** Whether the appointment is over and whether it can still be cancelled online (evaluated per request). */
function timing(startsAt: Date, status: "confirmed" | "cancelled") {
  const msLeft = startsAt.getTime() - Date.now();
  return {
    isPast: msLeft <= 0,
    canCancel: status === "confirmed" && msLeft > CUSTOMER_CANCEL_NOTICE_HOURS * 3600_000,
  };
}

function StatusBadge({ status, isPast }: { status: "confirmed" | "cancelled"; isPast: boolean }) {
  const [label, className] =
    status === "cancelled"
      ? ["Zrušeno", "bg-red-50 text-red-700"]
      : isPast
        ? ["Proběhlo", "bg-stone-100 text-stone-600"]
        : ["Potvrzeno", "bg-brand-50 text-brand-800"];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}
