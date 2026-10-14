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
import { isUuid } from "@/lib/validation";

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
  const requestedStaff = String(formData.get("staff_id") ?? "");

  if (!isValidDateString(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Zadejte platné datum a čas." };
  if (!isUuid(id)) return { error: "Rezervace nebyla nalezena." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, starts_at, ends_at, status, staff_id, service_id, services(duration_minutes)")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!booking || booking.status !== "confirmed" || !booking.services) return { error: "Rezervace nebyla nalezena." };

  // Another staff member must be active and do the service; keeping the current one is always fine.
  const staffId = isUuid(requestedStaff) ? requestedStaff : booking.staff_id;
  if (staffId !== booking.staff_id) {
    const { data: eligible } = await supabase
      .from("staff")
      .select("id, staff_services!inner(service_id)")
      .eq("id", staffId)
      .eq("business_id", business.id)
      .eq("is_active", true)
      .eq("staff_services.service_id", booking.service_id)
      .maybeSingle();
    if (!eligible) return { error: "Vybraný pracovník tuto službu nedělá nebo není aktivní." };
  }

  const startsAt = zonedTimeToUtc(date, timeToMinutes(time), business.timezone);
  if (startsAt.getTime() === new Date(booking.starts_at).getTime() && staffId === booking.staff_id) {
    return { error: "Vyberte jiný termín nebo pracovníka než stávající." };
  }

  // Check against opening hours and other bookings (excluding this one).
  const [{ data: regularOpening }, { data: others }, { data: shift }, { data: closure }] = await Promise.all([
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
      .eq("staff_id", staffId)
      .neq("id", id)
      .lt("starts_at", zonedTimeToUtc(addDays(date, 1), 0, business.timezone).toISOString())
      .gt("ends_at", zonedTimeToUtc(date, 0, business.timezone).toISOString()),
    supabase.from("staff").select("uses_business_hours, staff_hours(weekday, opens_at, closes_at)").eq("id", staffId).maybeSingle(),
    supabase
      .from("closures")
      .select("id")
      .eq("business_id", business.id)
      // The whole business, or this staff member's own days off.
      .or(`staff_id.is.null,staff_id.eq.${staffId}`)
      .lte("starts_on", date)
      .gte("ends_on", date)
      .limit(1)
      .maybeSingle(),
  ]);
  if (closure) return { error: "V tento den má podnik nebo pracovník volno (dovolená). Vyberte jiný den nebo pracovníka." };
  const opening = regularOpening;

  // A staff member with an own schedule only works their shift on that day.
  const workingWindow =
    shift && !shift.uses_business_hours ? (shift.staff_hours.find((h) => h.weekday === isoWeekday(date)) ?? null) : undefined;
  if (workingWindow === null) return { error: "Pracovník v tento den nepracuje. Vyberte jiný den nebo pracovníka." };

  const duration = booking.services.duration_minutes;
  const available = computeAvailableSlots({
    date,
    timeZone: business.timezone,
    opening,
    durationMinutes: duration,
    stepMinutes: 5,
    busy: (others ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    now: new Date(),
    within: workingWindow,
  });

  if (!available.some((s) => s.getTime() === startsAt.getTime())) {
    return { error: "Termín je v minulosti, mimo otevírací dobu, nebo koliduje s jinou rezervací pracovníka." };
  }

  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const { error } = await supabase
    .from("bookings")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      staff_id: staffId,
      // A new time needs a new reminder; a staff change alone doesn't.
      ...(startsAt.getTime() !== new Date(booking.starts_at).getTime() ? { reminder_sent_at: null } : {}),
    })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    // Exclusion constraint: someone booked the slot in the meantime.
    if (error.code === "23P01") return { error: "Termín se mezitím obsadil. Vyberte jiný." };
    return { error: "Rezervaci se nepodařilo přesunout." };
  }

  const timeChanged = startsAt.getTime() !== new Date(booking.starts_at).getTime();
  if (timeChanged) {
    const siteUrl = await getSiteUrl();
    after(() => notifyBookingRescheduled(id, booking.starts_at, siteUrl));
  }

  revalidatePath("/dashboard");
  return { success: timeChanged ? "Rezervace byla přesunuta." : "Rezervace byla předána jinému pracovníkovi." };
}
