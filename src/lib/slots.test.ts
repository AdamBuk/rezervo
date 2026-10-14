import { describe, expect, it } from "vitest";
import { computeAvailableSlots, computeStaffSlots, findNextAvailableDate, groupBusyByStaff, isClosedOn, staffSchedule } from "./slots";
import { addDays, isoWeekday, startOfWeek, toZoned, zonedTimeToUtc } from "./time";

const TZ = "Europe/Prague";
const hhmm = (d: Date) => d.toLocaleTimeString("cs-CZ", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const base = {
  date: "2026-10-14", // Wednesday, CEST (UTC+2)
  timeZone: TZ,
  opening: { opens_at: "09:00:00", closes_at: "12:00:00" },
  durationMinutes: 60,
  stepMinutes: 30,
  busy: [],
  now: new Date("2026-10-01T00:00:00Z"),
};

describe("zonedTimeToUtc", () => {
  it("converts Prague summer time", () => {
    expect(zonedTimeToUtc("2026-07-01", 9 * 60, TZ).toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
  it("converts Prague winter time", () => {
    expect(zonedTimeToUtc("2026-12-01", 9 * 60, TZ).toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
  it("handles the DST switch days", () => {
    // 2026-03-29: clocks jump 02:00 → 03:00; 2026-10-25: 03:00 → 02:00
    expect(zonedTimeToUtc("2026-03-29", 10 * 60, TZ).toISOString()).toBe("2026-03-29T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-25", 10 * 60, TZ).toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });
  it("round-trips through toZoned", () => {
    expect(toZoned(zonedTimeToUtc("2026-10-14", 13 * 60 + 15, TZ), TZ)).toEqual({ date: "2026-10-14", minutes: 795 });
  });
});

describe("calendar helpers", () => {
  it("computes ISO weekdays and week start", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("computeAvailableSlots", () => {
  it("offers aligned slots that fit into opening hours", () => {
    expect(computeAvailableSlots(base).map(hhmm)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("returns nothing on closed days", () => {
    expect(computeAvailableSlots({ ...base, opening: null })).toEqual([]);
  });

  it("excludes slots overlapping a booking but allows back-to-back", () => {
    const busy = [{ start: zonedTimeToUtc(base.date, 10 * 60, TZ), end: zonedTimeToUtc(base.date, 11 * 60, TZ) }];
    // 09:00–10:00 ends exactly when the booking starts; 11:00–12:00 starts when it ends.
    expect(computeAvailableSlots({ ...base, busy }).map(hhmm)).toEqual(["09:00", "11:00"]);
  });

  it("skips past slots and respects minimum notice", () => {
    const now = zonedTimeToUtc(base.date, 9 * 60 + 40, TZ);
    expect(computeAvailableSlots({ ...base, now }).map(hhmm)).toEqual(["10:00", "10:30", "11:00"]);
    expect(computeAvailableSlots({ ...base, now, minNoticeMinutes: 30 }).map(hhmm)).toEqual(["10:30", "11:00"]);
  });

  it("returns nothing when the service is longer than the opening", () => {
    expect(computeAvailableSlots({ ...base, durationMinutes: 240 })).toEqual([]);
  });

  it("aligns steps to the opening time, not the full hour", () => {
    const slots = computeAvailableSlots({
      ...base,
      opening: { opens_at: "08:45", closes_at: "10:00" },
      durationMinutes: 30,
      stepMinutes: 15,
    });
    expect(slots.map(hhmm)).toEqual(["08:45", "09:00", "09:15", "09:30"]);
  });
});

describe("findNextAvailableDate", () => {
  const weekdaysOnly = (date: string) => (isoWeekday(date) <= 5 ? { opens_at: "09:00:00", closes_at: "10:00:00" } : null);
  const input = {
    timeZone: TZ,
    durationMinutes: 60,
    stepMinutes: 15,
    staff: [{ staffId: "a", busy: [] as { start: Date; end: Date }[] }],
    now: new Date("2026-10-01T00:00:00Z"),
    openingFor: weekdaysOnly,
  };

  it("skips closed days", () => {
    // 2026-10-17 is a Saturday
    expect(findNextAvailableDate({ ...input, from: "2026-10-17", to: "2026-10-31" })).toBe("2026-10-19");
  });

  it("skips fully booked days", () => {
    const busy = [{ start: zonedTimeToUtc("2026-10-19", 9 * 60, TZ), end: zonedTimeToUtc("2026-10-19", 10 * 60, TZ) }];
    expect(findNextAvailableDate({ ...input, staff: [{ staffId: "a", busy }], from: "2026-10-19", to: "2026-10-31" })).toBe(
      "2026-10-20",
    );
  });

  it("a day is free when any staff member is", () => {
    const busy = [{ start: zonedTimeToUtc("2026-10-19", 9 * 60, TZ), end: zonedTimeToUtc("2026-10-19", 10 * 60, TZ) }];
    const staff = [
      { staffId: "a", busy },
      { staffId: "b", busy: [] },
    ];
    expect(findNextAvailableDate({ ...input, staff, from: "2026-10-19", to: "2026-10-31" })).toBe("2026-10-19");
  });

  it("returns null when nothing is free in the range", () => {
    expect(findNextAvailableDate({ ...input, from: "2026-10-17", to: "2026-10-18" })).toBeNull();
  });
});

describe("isClosedOn", () => {
  const closures = [
    { starts_on: "2026-12-24", ends_on: "2026-12-26" },
    { starts_on: "2026-12-31", ends_on: "2026-12-31" },
  ];

  it("matches inclusive ranges", () => {
    expect(isClosedOn("2026-12-24", closures)).toBe(true);
    expect(isClosedOn("2026-12-25", closures)).toBe(true);
    expect(isClosedOn("2026-12-26", closures)).toBe(true);
    expect(isClosedOn("2026-12-31", closures)).toBe(true);
  });

  it("leaves other days open", () => {
    expect(isClosedOn("2026-12-23", closures)).toBe(false);
    expect(isClosedOn("2026-12-27", closures)).toBe(false);
    expect(isClosedOn("2026-12-24", [])).toBe(false);
  });
});

describe("computeStaffSlots", () => {
  const day = "2026-10-19";
  const at = (h: number, m = 0) => zonedTimeToUtc(day, h * 60 + m, TZ);
  const base = {
    date: day,
    timeZone: TZ,
    opening: { opens_at: "09:00:00", closes_at: "11:00:00" },
    durationMinutes: 60,
    stepMinutes: 30,
    now: new Date("2026-10-01T00:00:00Z"),
  };

  it("offers a slot when at least one staff member is free, listing who in staff order", () => {
    const slots = computeStaffSlots({
      ...base,
      staff: [
        { staffId: "jana", busy: [{ start: at(9), end: at(10) }] },
        { staffId: "petr", busy: [{ start: at(10), end: at(11) }] },
      ],
    });
    expect(slots.map((s) => [hhmm(s.start), s.staffIds])).toEqual([
      ["09:00", ["petr"]],
      ["10:00", ["jana"]],
    ]);
  });

  it("returns nothing without staff", () => {
    expect(computeStaffSlots({ ...base, staff: [] })).toEqual([]);
  });

  it("keeps staff order when both are free", () => {
    const slots = computeStaffSlots({ ...base, staff: [{ staffId: "b", busy: [] }, { staffId: "a", busy: [] }] });
    expect(slots[0].staffIds).toEqual(["b", "a"]);
  });
});

describe("groupBusyByStaff", () => {
  it("groups rows and keeps staff without bookings", () => {
    const rows = [
      { staff_id: "a", starts_at: "2026-10-19T08:00:00Z", ends_at: "2026-10-19T09:00:00Z" },
      { staff_id: "x", starts_at: "2026-10-19T08:00:00Z", ends_at: "2026-10-19T09:00:00Z" },
    ];
    const grouped = groupBusyByStaff([{ id: "a" }, { id: "b" }], rows);
    expect(grouped.map((g) => [g.staffId, g.busy.length])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
  });
});

describe("staff schedules", () => {
  const day = "2026-10-19"; // Monday
  const base = {
    date: day,
    timeZone: TZ,
    opening: { opens_at: "09:00:00", closes_at: "13:00:00" },
    durationMinutes: 60,
    stepMinutes: 30,
    now: new Date("2026-10-01T00:00:00Z"),
  };

  it("limits a staff member to their shift, aligned to opening time", () => {
    const schedule = staffSchedule(false, [{ weekday: 1, opens_at: "10:15:00", closes_at: "12:30:00" }]);
    const slots = computeStaffSlots({ ...base, staff: [{ staffId: "eva", busy: [], schedule }] });
    expect(slots.map((s) => hhmm(s.start))).toEqual(["10:30", "11:00", "11:30"]);
  });

  it("skips staff on their day off and keeps business-hours staff", () => {
    const off = staffSchedule(false, [{ weekday: 2, opens_at: "09:00:00", closes_at: "13:00:00" }]);
    const slots = computeStaffSlots({
      ...base,
      staff: [
        { staffId: "eva", busy: [], schedule: off },
        { staffId: "ota", busy: [], schedule: staffSchedule(true, []) },
      ],
    });
    expect(slots).toHaveLength(7);
    expect(slots.every((s) => s.staffIds.join() === "ota")).toBe(true);
  });

  it("never extends past opening hours", () => {
    const late = staffSchedule(false, [{ weekday: 1, opens_at: "12:00:00", closes_at: "18:00:00" }]);
    const slots = computeStaffSlots({ ...base, staff: [{ staffId: "eva", busy: [], schedule: late }] });
    expect(slots.map((s) => hhmm(s.start))).toEqual(["12:00"]);
  });
});

describe("staff days off", () => {
  it("skips a staff member on leave and keeps the others", () => {
    const slots = computeStaffSlots({
      date: "2026-10-19",
      timeZone: TZ,
      opening: { opens_at: "09:00:00", closes_at: "10:00:00" },
      durationMinutes: 60,
      stepMinutes: 30,
      now: new Date("2026-10-01T00:00:00Z"),
      staff: [
        { staffId: "eva", busy: [], daysOff: [{ starts_on: "2026-10-18", ends_on: "2026-10-20" }] },
        { staffId: "ota", busy: [], daysOff: [{ starts_on: "2026-10-21", ends_on: "2026-10-21" }] },
      ],
    });
    expect(slots.map((s) => s.staffIds)).toEqual([["ota"]]);
  });
});
