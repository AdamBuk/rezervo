import { describe, expect, it } from "vitest";
import { parseIsoDateTime, validateCreateBooking, validateSlotsQuery } from "./validation";

const SERVICE_ID = "5b0c6f8e-2a7d-4c1e-9f3a-1b2c3d4e5f60";

describe("parseIsoDateTime", () => {
  it("accepts timestamps with Z or an offset", () => {
    expect(parseIsoDateTime("2026-10-14T10:00:00Z")?.toISOString()).toBe("2026-10-14T10:00:00.000Z");
    expect(parseIsoDateTime("2026-10-14T10:00+02:00")?.toISOString()).toBe("2026-10-14T08:00:00.000Z");
    expect(parseIsoDateTime("2026-10-14T00:30:00.000-01:00")?.toISOString()).toBe("2026-10-14T01:30:00.000Z");
  });

  it("rejects ambiguous or invalid values", () => {
    expect(parseIsoDateTime("2026-10-14T10:00:00")).toBeNull();
    expect(parseIsoDateTime("2026-10-14")).toBeNull();
    expect(parseIsoDateTime("2026-02-30T10:00:00Z")).toBeNull();
    expect(parseIsoDateTime("2026-10-14T25:00:00Z")).toBeNull();
    expect(parseIsoDateTime(1760000000)).toBeNull();
  });
});

describe("validateSlotsQuery", () => {
  it("accepts valid parameters", () => {
    const r = validateSlotsQuery(new URLSearchParams({ service_id: SERVICE_ID.toUpperCase(), date: "2026-10-14" }));
    expect(r).toEqual({ ok: true, value: { serviceId: SERVICE_ID, date: "2026-10-14" } });
  });

  it("lists every invalid field", () => {
    const r = validateSlotsQuery(new URLSearchParams({ service_id: "x", date: "2026-13-01" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(["service_id", "date"]);
  });
});

describe("validateCreateBooking", () => {
  const valid = {
    service_id: SERVICE_ID,
    starts_at: "2026-10-14T10:00:00+02:00",
    customer: { name: "  Jana Nováková ", email: " Jana@Example.CZ ", phone: "+420 777 123 456" },
  };

  it("normalises a valid body", () => {
    const r = validateCreateBooking(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.customer).toEqual({ name: "Jana Nováková", email: "jana@example.cz", phone: "+420 777 123 456" });
      expect(r.value.startsAt.toISOString()).toBe("2026-10-14T08:00:00.000Z");
    }
  });

  it("rejects non-objects", () => {
    for (const body of [null, [], "x", 1]) {
      const r = validateCreateBooking(body);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0].field).toBe("body");
    }
  });

  it("reports all customer field errors", () => {
    const r = validateCreateBooking({ ...valid, customer: { name: "J", email: "nope", phone: "12" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(["customer.name", "customer.email", "customer.phone"]);
  });

  it("requires service, start and customer", () => {
    const r = validateCreateBooking({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toEqual(["service_id", "starts_at", "customer"]);
  });
});
