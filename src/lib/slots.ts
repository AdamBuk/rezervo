import { timeToMinutes, zonedTimeToUtc } from "./time";

export type Interval = { start: Date; end: Date };

export type SlotInput = {
  /** Calendar day in the business timezone, "YYYY-MM-DD" */
  date: string;
  timeZone: string;
  /** Opening interval for that weekday, or null when closed */
  opening: { opens_at: string; closes_at: string } | null;
  durationMinutes: number;
  stepMinutes: number;
  /** Confirmed bookings that may overlap the day */
  busy: Interval[];
  now: Date;
  /** Minimum notice before a slot can be booked */
  minNoticeMinutes?: number;
};

/**
 * Start times a service can be booked at on a given day. A slot is offered when
 * the whole service fits into opening hours, it doesn't overlap any confirmed
 * booking and it starts after now + minimum notice. Start times are aligned to
 * `stepMinutes` counted from opening time – the same rule create_booking() enforces.
 */
export function computeAvailableSlots(input: SlotInput): Date[] {
  const { date, timeZone, opening, durationMinutes, stepMinutes, busy, now, minNoticeMinutes = 0 } = input;
  if (!opening || durationMinutes <= 0 || stepMinutes <= 0) return [];

  const opens = timeToMinutes(opening.opens_at);
  const closes = timeToMinutes(opening.closes_at);
  const earliest = now.getTime() + minNoticeMinutes * 60_000;
  const slots: Date[] = [];

  for (let minute = opens; minute + durationMinutes <= closes; minute += stepMinutes) {
    const start = zonedTimeToUtc(date, minute, timeZone);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    if (start.getTime() < earliest) continue;
    // Half-open intervals: a booking ending at 10:00 doesn't block a slot starting at 10:00.
    if (busy.some((b) => b.start < end && b.end > start)) continue;

    slots.push(start);
  }
  return slots;
}
