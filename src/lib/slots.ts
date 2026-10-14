import { addDays, isoWeekday, timeToMinutes, zonedTimeToUtc } from "./time";

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
  /** Narrower working window (a staff member's shift); slots stay aligned to opening time */
  within?: OpeningInterval | null;
};

export type OpeningInterval = { opens_at: string; closes_at: string };

/**
 * Start times a service can be booked at on a given day. A slot is offered when
 * the whole service fits into opening hours, it doesn't overlap any confirmed
 * booking and it starts after now + minimum notice. Start times are aligned to
 * `stepMinutes` counted from opening time – the same rule create_booking() enforces.
 */
export function computeAvailableSlots(input: SlotInput): Date[] {
  const { date, timeZone, opening, durationMinutes, stepMinutes, busy, now, minNoticeMinutes = 0, within } = input;
  if (!opening || durationMinutes <= 0 || stepMinutes <= 0) return [];

  const opens = timeToMinutes(opening.opens_at);
  const closes = Math.min(timeToMinutes(opening.closes_at), within ? timeToMinutes(within.closes_at) : Infinity);
  const earliestStart = within ? timeToMinutes(within.opens_at) : opens;
  const earliest = now.getTime() + minNoticeMinutes * 60_000;
  const slots: Date[] = [];

  for (let minute = opens; minute + durationMinutes <= closes; minute += stepMinutes) {
    const start = zonedTimeToUtc(date, minute, timeZone);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    if (start.getTime() < earliest || minute < earliestStart) continue;
    // Half-open intervals: a booking ending at 10:00 doesn't block a slot starting at 10:00.
    if (busy.some((b) => b.start < end && b.end > start)) continue;

    slots.push(start);
  }
  return slots;
}

/** Working hours by ISO weekday; a missing weekday is a day off. */
export type StaffSchedule = Partial<Record<number, OpeningInterval>>;

/** Confirmed bookings of one staff member, plus their own schedule (undefined = business opening hours). */
export type StaffBusy = {
  staffId: string;
  busy: Interval[];
  schedule?: StaffSchedule;
  /** The staff member's own days off (holiday, sick leave) */
  daysOff?: readonly DateRange[];
};

export type StaffSlot = {
  start: Date;
  /** Staff members free for the whole slot, in the given (sort) order */
  staffIds: string[];
};

export type StaffSlotInput = Omit<SlotInput, "busy"> & {
  /** Staff members who perform the service, in sort order (the order create_booking() assigns "anyone" in) */
  staff: readonly StaffBusy[];
};

/** Start times at which at least one of the staff members is free, with who is free. */
export function computeStaffSlots(input: StaffSlotInput): StaffSlot[] {
  const { staff, ...rest } = input;
  const byStart = new Map<number, StaffSlot>();
  const weekday = isoWeekday(rest.date);
  for (const member of staff) {
    const within = member.schedule ? member.schedule[weekday] : undefined;
    if (member.schedule && !within) continue; // not on shift that weekday
    if (member.daysOff && isClosedOn(rest.date, member.daysOff)) continue; // on leave
    for (const start of computeAvailableSlots({ ...rest, busy: member.busy, within })) {
      const slot = byStart.get(start.getTime());
      if (slot) slot.staffIds.push(member.staffId);
      else byStart.set(start.getTime(), { start, staffIds: [member.staffId] });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Groups busy intervals (e.g. from get_staff_busy_intervals) by staff member, keeping the given order. */
export function groupBusyByStaff(
  staff: readonly { id: string; schedule?: StaffSchedule; daysOff?: readonly DateRange[] }[],
  rows: readonly { staff_id: string; starts_at: string; ends_at: string }[],
): StaffBusy[] {
  return staff.map(({ id: staffId, schedule, daysOff }) => ({
    staffId,
    schedule,
    daysOff,
    busy: rows
      .filter((r) => r.staff_id === staffId)
      .map((r) => ({ start: new Date(r.starts_at), end: new Date(r.ends_at) })),
  }));
}

export type DateRange = { starts_on: string; ends_on: string };

/** Whether a calendar day ("YYYY-MM-DD") falls into any of the inclusive ranges. */
export function isClosedOn(date: string, closures: readonly DateRange[]): boolean {
  return closures.some((c) => c.starts_on <= date && date <= c.ends_on);
}

export type NextAvailableInput = Omit<StaffSlotInput, "date" | "opening"> & {
  /** First and last calendar day to check, inclusive ("YYYY-MM-DD") */
  from: string;
  to: string;
  openingFor: (date: string) => SlotInput["opening"];
};

/** The first day in [from, to] with at least one free slot, or null. */
export function findNextAvailableDate(input: NextAvailableInput): string | null {
  const { from, to, openingFor, ...rest } = input;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const opening = openingFor(date);
    if (opening && computeStaffSlots({ ...rest, date, opening }).length > 0) return date;
  }
  return null;
}

/** Builds a schedule from staff_hours rows, or undefined when the staff member follows opening hours. */
export function staffSchedule(
  usesBusinessHours: boolean,
  rows: readonly { weekday: number; opens_at: string; closes_at: string }[],
): StaffSchedule | undefined {
  if (usesBusinessHours) return undefined;
  const schedule: StaffSchedule = {};
  for (const r of rows) schedule[r.weekday] = { opens_at: r.opens_at, closes_at: r.closes_at };
  return schedule;
}
