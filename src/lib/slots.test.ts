import { describe, expect, it } from "vitest";
import { computeAvailableSlots, findNextAvailableDate } from "./slots";
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
    busy: [] as { start: Date; end: Date }[],
    now: new Date("2026-10-01T00:00:00Z"),
    openingFor: weekdaysOnly,
  };

  it("skips closed days", () => {
    // 2026-10-17 is a Saturday
    expect(findNextAvailableDate({ ...input, from: "2026-10-17", to: "2026-10-31" })).toBe("2026-10-19");
  });

  it("skips fully booked days", () => {
    const busy = [{ start: zonedTimeToUtc("2026-10-19", 9 * 60, TZ), end: zonedTimeToUtc("2026-10-19", 10 * 60, TZ) }];
    expect(findNextAvailableDate({ ...input, busy, from: "2026-10-19", to: "2026-10-31" })).toBe("2026-10-20");
  });

  it("returns null when nothing is free in the range", () => {
    expect(findNextAvailableDate({ ...input, from: "2026-10-17", to: "2026-10-18" })).toBeNull();
  });
});
