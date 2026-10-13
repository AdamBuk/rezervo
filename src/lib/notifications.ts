import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import {
  bookingConfirmationEmail,
  cancellationEmail,
  customerCancelledOwnerEmail,
  ownerNotificationEmail,
  reminderEmail,
  rescheduleEmail,
  type BookingEmailData,
} from "@/lib/email/templates";
import { addDays, todayInTimeZone, toZoned } from "@/lib/time";
import { bookingManageUrl, getBookingLinkSecret } from "@/lib/booking-link";

const BOOKING_SELECT =
  "id, starts_at, customer_name, customer_email, customer_phone, services(name, duration_minutes, price_czk), staff(name), businesses(name, slug, address, phone, timezone, notification_email, staff(is_active))" as const;

type BookingWithRelations = {
  id: string;
  starts_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  services: { name: string; duration_minutes: number; price_czk: number } | null;
  staff: { name: string } | null;
  businesses: {
    name: string;
    slug: string;
    address: string | null;
    phone: string | null;
    timezone: string;
    notification_email: string;
    staff: { is_active: boolean }[];
  } | null;
};

function toEmailData(b: BookingWithRelations, siteUrl: string): BookingEmailData | null {
  if (!b.services || !b.businesses) return null;
  return {
    customerName: b.customer_name,
    customerEmail: b.customer_email,
    customerPhone: b.customer_phone,
    serviceName: b.services.name,
    staffName: b.businesses.staff.filter((m) => m.is_active).length > 1 ? (b.staff?.name ?? null) : null,
    durationMinutes: b.services.duration_minutes,
    priceCzk: b.services.price_czk,
    startsAt: b.starts_at,
    business: {
      name: b.businesses.name,
      slug: b.businesses.slug,
      address: b.businesses.address,
      phone: b.businesses.phone,
      timezone: b.businesses.timezone,
      notificationEmail: b.businesses.notification_email,
    },
    siteUrl,
    manageUrl: bookingManageUrl(siteUrl, b.id, getBookingLinkSecret()),
  };
}

async function loadBooking(bookingId: string, siteUrl: string): Promise<BookingEmailData | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", bookingId).maybeSingle();
  if (error || !data) {
    console.error("[notifications] Booking not found", bookingId, error);
    return null;
  }
  return toEmailData(data, siteUrl);
}

// Notification helpers never throw: a failed e-mail must not break the booking flow.
// `siteUrl` is resolved by the caller while the request is still active (they run inside after()).

export async function notifyBookingCreated(bookingId: string, siteUrl: string) {
  try {
    const data = await loadBooking(bookingId, siteUrl);
    if (!data) return;
    await Promise.all([sendEmail(bookingConfirmationEmail(data)), sendEmail(ownerNotificationEmail(data))]);
  } catch (err) {
    console.error("[notifications] notifyBookingCreated failed", err);
  }
}

export async function notifyBookingCancelled(bookingId: string, siteUrl: string) {
  try {
    const data = await loadBooking(bookingId, siteUrl);
    if (data) await sendEmail(cancellationEmail(data));
  } catch (err) {
    console.error("[notifications] notifyBookingCancelled failed", err);
  }
}

/** Customer cancelled via the manage link: confirm to them and let the owner know. */
export async function notifyBookingCancelledByCustomer(bookingId: string, siteUrl: string) {
  try {
    const data = await loadBooking(bookingId, siteUrl);
    if (!data) return;
    await Promise.all([sendEmail(cancellationEmail(data)), sendEmail(customerCancelledOwnerEmail(data))]);
  } catch (err) {
    console.error("[notifications] notifyBookingCancelledByCustomer failed", err);
  }
}

export async function notifyBookingRescheduled(bookingId: string, previousStartsAt: string, siteUrl: string) {
  try {
    const data = await loadBooking(bookingId, siteUrl);
    if (data) await sendEmail(rescheduleEmail(data, previousStartsAt));
  } catch (err) {
    console.error("[notifications] notifyBookingRescheduled failed", err);
  }
}

/**
 * Sends reminders for confirmed bookings taking place tomorrow (in each
 * business's timezone). Each booking is claimed by setting reminder_sent_at
 * first, so overlapping cron runs can't send a reminder twice.
 */
export async function sendDueReminders(now = new Date()) {
  const supabase = createAdminClient();
  const siteUrl = await getSiteUrl();

  // Wide window; the exact "tomorrow" check happens per business timezone below.
  const { data: candidates, error } = await supabase
    .from("bookings")
    .select(`${BOOKING_SELECT}, reminder_sent_at`)
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lt("starts_at", new Date(now.getTime() + 50 * 3600_000).toISOString());
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const booking of candidates ?? []) {
    const tz = booking.businesses?.timezone;
    if (!tz) continue;
    const tomorrow = addDays(todayInTimeZone(tz, now), 1);
    if (toZoned(new Date(booking.starts_at), tz).date !== tomorrow) continue;

    const { data: claimed } = await supabase
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", booking.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const data = toEmailData(booking, siteUrl);
    const ok = data ? await sendEmail(reminderEmail(data)) : false;
    if (ok) {
      sent++;
    } else {
      failed++;
      // Release the claim so the next run can retry.
      await supabase.from("bookings").update({ reminder_sent_at: null }).eq("id", booking.id);
    }
  }
  return { checked: candidates?.length ?? 0, sent, failed };
}
