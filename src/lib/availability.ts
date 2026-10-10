import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { computeAvailableSlots, findNextAvailableDate } from "@/lib/slots";
import { addDays, isoWeekday, isValidDateString, todayInTimeZone, zonedTimeToUtc } from "@/lib/time";
import { BOOKING_HORIZON_DAYS, MIN_NOTICE_MINUTES } from "@/lib/constants";

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

/** How many days ahead to look for the nearest free day (one DB query covers all of them). */
const NEXT_AVAILABLE_LOOKAHEAD_DAYS = 21;

export type DayAvailability = {
  /** Available start times (ISO strings) on the requested day */
  slots: string[];
  /** When the day is full or closed: the nearest later day with a free slot, if any within the lookahead */
  nextAvailable: string | null;
};

/** Free start times for a service on a calendar day, plus the nearest free day when that one is full. */
export async function getAvailability(slug: string, serviceId: string, date: string): Promise<DayAvailability | null> {
  const data = await getPublicBusiness(slug);
  if (!data || !isValidDateString(date)) return null;

  const { business, services, hours } = data;
  const service = services.find((s) => s.id === serviceId);
  if (!service) return null;

  const today = todayInTimeZone(business.timezone);
  const lastBookable = addDays(today, BOOKING_HORIZON_DAYS);
  if (date < today || date > lastBookable) return { slots: [], nextAvailable: null };

  const lookaheadEnd = [addDays(date, NEXT_AVAILABLE_LOOKAHEAD_DAYS), lastBookable].sort()[0];
  const supabase = createPublicClient();
  const { data: busy, error } = await supabase.rpc("get_busy_intervals", {
    p_business_id: business.id,
    p_from: zonedTimeToUtc(date, 0, business.timezone).toISOString(),
    p_to: zonedTimeToUtc(addDays(lookaheadEnd, 1), 0, business.timezone).toISOString(),
  });
  if (error) throw error;

  const input = {
    timeZone: business.timezone,
    durationMinutes: service.duration_minutes,
    stepMinutes: business.slot_step_minutes,
    busy: (busy ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    now: new Date(),
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  };
  const openingFor = (day: string) => hours.find((h) => h.weekday === isoWeekday(day)) ?? null;

  const slots = computeAvailableSlots({ ...input, date, opening: openingFor(date) }).map((d) => d.toISOString());
  const nextAvailable = slots.length
    ? null
    : findNextAvailableDate({ ...input, from: addDays(date, 1), to: lookaheadEnd, openingFor });

  return { slots, nextAvailable };
}
