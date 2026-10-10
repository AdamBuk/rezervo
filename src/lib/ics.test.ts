import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "./ics";

const event: CalendarEvent = {
  uid: "abc-123",
  title: "Dámský střih – Kadeřnictví U Nůžek",
  start: new Date("2026-10-14T08:00:00Z"),
  end: new Date("2026-10-14T09:00:00Z"),
  location: "Dlouhá 12, 110 00 Praha 1",
  description: "Změna termínu; volejte\n+420 602 111 222",
};

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-10-10T10:00:00Z"));

  it("writes a valid VEVENT in UTC with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261014T080000Z\r\n");
    expect(ics).toContain("DTEND:20261014T090000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261010T100000Z\r\n");
    expect(ics).toContain("UID:abc-123@rezervo\r\n");
  });

  it("escapes text values", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("LOCATION:Dlouhá 12\\, 110 00 Praha 1");
    expect(unfolded).toContain("DESCRIPTION:Změna termínu\\; volejte\\n+420 602 111 222");
  });

  it("folds lines to at most 75 bytes", () => {
    const long = buildIcs({ ...event, title: "Ž".repeat(80) });
    for (const line of long.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n /g, "")).toContain(`SUMMARY:${"Ž".repeat(80)}`);
  });

  it("omits empty optional fields", () => {
    const minimal = buildIcs({ ...event, location: null, description: undefined });
    expect(minimal).not.toContain("LOCATION");
    expect(minimal).not.toContain("DESCRIPTION");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template link", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261014T080000Z/20261014T090000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("location")).toBe(event.location);
  });
});
