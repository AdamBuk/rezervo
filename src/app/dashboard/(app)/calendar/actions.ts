"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeAvailableSlots } from "@/lib/slots";
import { addDays, isoWeekday, isValidDateString, timeToMinutes, zonedTimeToUtc } from "@/lib/time";
import type { ActionState } from "@/lib/constants";
import { getSiteUrl } from "@/lib/site-url";
import { notifyBookingCancelled, notifyBookingRescheduled } from "@/lib/notifications";

export async function cancelBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Rezervaci se nepodařilo zrušit." };

  const siteUrl = await getSiteUrl();
  after(() => notifyBookingCancelled(id, siteUrl));

  revalidatePath("/dashboard");
  return { success: "Rezervace byla zrušena." };
}

export async function rescheduleBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");

  if (!isValidDateString(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Zadejte platné datum a čas." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, starts_at, ends_at, status, services(duration_minutes)")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!booking || booking.status !== "confirmed" || !booking.services) return { error: "Rezervace nebyla nalezena." };

  const startsAt = zonedTimeToUtc(date, timeToMinutes(time), business.timezone);
  if (startsAt.getTime() === new Date(booking.starts_at).getTime()) return { error: "Vyberte jiný termín než stávající." };

  // Check against opening hours and other bookings (excluding this one).
  const [{ data: regularOpening }, { data: others }, { data: closure }] = await Promise.all([
    supabase
      .from("opening_hours")
      .select("opens_at, closes_at")
      .eq("business_id", business.id)
      .eq("weekday", isoWeekday(date))
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("starts_at, ends_at")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .neq("id", id)
      .lt("starts_at", zonedTimeToUtc(addDays(date, 1), 0, business.timezone).toISOString())
      .gt("ends_at", zonedTimeToUtc(date, 0, business.timezone).toISOString()),
    supabase
      .from("closures")
      .select("id")
      .eq("business_id", business.id)
      .lte("starts_on", date)
      .gte("ends_on", date)
      .limit(1)
      .maybeSingle(),
  ]);
  if (closure) return { error: "V tento den máte nastavené zavřeno (dovolená). Vyberte jiný den." };
  const opening = regularOpening;

  const duration = booking.services.duration_minutes;
  const available = computeAvailableSlots({
    date,
    timeZone: business.timezone,
    opening,
    durationMinutes: duration,
    stepMinutes: 5,
    busy: (others ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    now: new Date(),
  });

  if (!available.some((s) => s.getTime() === startsAt.getTime())) {
    return { error: "Termín je v minulosti, mimo otevírací dobu, nebo koliduje s jinou rezervací." };
  }

  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const { error } = await supabase
    .from("bookings")
    .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reminder_sent_at: null })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    // Exclusion constraint: someone booked the slot in the meantime.
    if (error.code === "23P01") return { error: "Termín se mezitím obsadil. Vyberte jiný." };
    return { error: "Rezervaci se nepodařilo přesunout." };
  }

  const siteUrl = await getSiteUrl();
  after(() => notifyBookingRescheduled(id, booking.starts_at, siteUrl));

  revalidatePath("/dashboard");
  return { success: "Rezervace byla přesunuta." };
}
