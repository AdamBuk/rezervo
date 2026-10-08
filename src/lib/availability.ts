import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { computeAvailableSlots } from "@/lib/slots";
import { addDays, isoWeekday, isValidDateString, todayInTimeZone, zonedTimeToUtc } from "@/lib/time";
import { BOOKING_HORIZON_DAYS } from "@/lib/constants";

/** Customers can't book a slot starting sooner than this. */
export const MIN_NOTICE_MINUTES = 30;

/** Public booking page data, looked up by slug. */
export const getPublicBusiness = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, slug, description, address, phone, timezone, slot_step_minutes")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) return null;

  const [{ data: services }, { data: hours }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_czk")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("business_id", business.id).order("weekday"),
  ]);

  return { business, services: services ?? [], hours: hours ?? [] };
});

export type PublicBusiness = NonNullable<Awaited<ReturnType<typeof getPublicBusiness>>>;

/** Available start times (ISO strings) for a service on a calendar day. */
export async function getAvailableSlots(slug: string, serviceId: string, date: string): Promise<string[] | null> {
  const data = await getPublicBusiness(slug);
  if (!data || !isValidDateString(date)) return null;

  const { business, services, hours } = data;
  const service = services.find((s) => s.id === serviceId);
  if (!service) return null;

  const today = todayInTimeZone(business.timezone);
  if (date < today || date > addDays(today, BOOKING_HORIZON_DAYS)) return [];

  const opening = hours.find((h) => h.weekday === isoWeekday(date)) ?? null;
  if (!opening) return [];

  const dayStart = zonedTimeToUtc(date, 0, business.timezone);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), 0, business.timezone);

  const supabase = createPublicClient();
  const { data: busy, error } = await supabase.rpc("get_busy_intervals", {
    p_business_id: business.id,
    p_from: dayStart.toISOString(),
    p_to: dayEnd.toISOString(),
  });
  if (error) throw error;

  return computeAvailableSlots({
    date,
    timeZone: business.timezone,
    opening,
    durationMinutes: service.duration_minutes,
    stepMinutes: business.slot_step_minutes,
    busy: (busy ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    now: new Date(),
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  }).map((d) => d.toISOString());
}
