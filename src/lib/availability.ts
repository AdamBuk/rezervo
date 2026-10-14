import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { computeStaffSlots, findNextAvailableDate, groupBusyByStaff, isClosedOn, staffSchedule, type StaffSchedule } from "@/lib/slots";
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

  const [{ data: services }, { data: hours }, { data: closures }, { data: staff }, { data: staffServices }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_czk")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("business_id", business.id).order("weekday"),
    // Upcoming and current closures only; the booking horizon is 60 days, so a handful is plenty.
    supabase
      .from("closures")
      .select("starts_on, ends_on, staff_id")
      .eq("business_id", business.id)
      .gte("ends_on", todayInTimeZone(business.timezone))
      .order("starts_on")
      .limit(200),
    supabase
      .from("staff")
      .select("id, name, uses_business_hours, staff_hours(weekday, opens_at, closes_at)")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at")
      .order("id"),
    supabase.from("staff_services").select("staff_id, service_id, staff!inner(business_id)").eq("staff.business_id", business.id),
  ]);

  const allClosures = closures ?? [];
  const daysOff = (staffId: string) =>
    allClosures.filter((c) => c.staff_id === staffId).map(({ starts_on, ends_on }) => ({ starts_on, ends_on }));
  // Public (shown on the booking page): which weekdays each staff member works (null = all open days) and their days off.
  const activeStaff = (staff ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    workdays: m.uses_business_hours ? null : m.staff_hours.map((h) => h.weekday),
    daysOff: daysOff(m.id),
  }));
  // Server-only: who works when (undefined = whenever the business is open).
  const schedules: Record<string, StaffSchedule | undefined> = Object.fromEntries(
    (staff ?? []).map((m) => [m.id, staffSchedule(m.uses_business_hours, m.staff_hours)]),
  );
  const links = staffServices ?? [];
  // Active staff per service, in sort order – the same order create_booking() assigns "anyone" in.
  const staffByService: Record<string, string[]> = {};
  for (const service of services ?? []) {
    staffByService[service.id] = activeStaff
      .filter((member) => links.some((l) => l.staff_id === member.id && l.service_id === service.id))
      .map((member) => member.id);
  }

  return {
    business,
    // Services nobody performs can't be booked, so they aren't offered at all.
    services: (services ?? []).filter((s) => staffByService[s.id].length > 0),
    hours: hours ?? [],
    // Whole-business closures only; staff days off are per staff member above.
    closures: allClosures.filter((c) => c.staff_id === null).map(({ starts_on, ends_on }) => ({ starts_on, ends_on })),
    staff: activeStaff,
    staffByService,
    schedules,
  };
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

/**
 * Free start times for a service on a calendar day, plus the nearest free day when that one is full.
 * With `staffId` only that staff member counts, otherwise anyone who performs the service.
 */
export async function getAvailability(
  slug: string,
  serviceId: string,
  date: string,
  staffId: string | null = null,
): Promise<DayAvailability | null> {
  const data = await getPublicBusiness(slug);
  if (!data || !isValidDateString(date)) return null;

  const { business, services, hours, closures, staffByService, schedules, staff } = data;
  const service = services.find((s) => s.id === serviceId);
  if (!service) return null;
  const eligible = staffByService[service.id].filter((id) => staffId === null || id === staffId);
  if (!eligible.length) return null;

  const today = todayInTimeZone(business.timezone);
  const lastBookable = addDays(today, BOOKING_HORIZON_DAYS);
  if (date < today || date > lastBookable) return { slots: [], nextAvailable: null };

  const supabase = createPublicClient();
  const busyBetween = async (fromDay: string, toDay: string) => {
    const { data: busy, error } = await supabase.rpc("get_staff_busy_intervals", {
      p_business_id: business.id,
      p_from: zonedTimeToUtc(fromDay, 0, business.timezone).toISOString(),
      p_to: zonedTimeToUtc(addDays(toDay, 1), 0, business.timezone).toISOString(),
    });
    if (error) throw error;
    return groupBusyByStaff(
      eligible.map((id) => ({ id, schedule: schedules[id], daysOff: staff.find((m) => m.id === id)?.daysOff })),
      busy ?? [],
    );
  };

  const base = {
    timeZone: business.timezone,
    durationMinutes: service.duration_minutes,
    stepMinutes: business.slot_step_minutes,
    now: new Date(),
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  };
  const openingFor = (day: string) =>
    isClosedOn(day, closures) ? null : (hours.find((h) => h.weekday === isoWeekday(day)) ?? null);

  // Hot path: only the requested day. The wider lookahead runs just when that day is full or closed.
  const opening = openingFor(date);
  const slots = opening
    ? computeStaffSlots({ ...base, date, opening, staff: await busyBetween(date, date) }).map((s) => s.start.toISOString())
    : [];
  if (slots.length) return { slots, nextAvailable: null };

  const from = addDays(date, 1);
  const to = [addDays(date, NEXT_AVAILABLE_LOOKAHEAD_DAYS), lastBookable].sort()[0];
  if (from > to) return { slots, nextAvailable: null };
  const nextAvailable = findNextAvailableDate({ ...base, staff: await busyBetween(from, to), from, to, openingFor });

  return { slots, nextAvailable };
}
