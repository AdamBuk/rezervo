import { beforeEach, describe, expect, it } from "vitest";
import {
  createApiHandlers,
  MAX_BODY_BYTES,
  RATE_LIMITS,
  type ApiBookingRecord,
  type ApiBusiness,
  type ApiService,
  type ApiStore,
  type CreateBookingResult,
  type RateLimiter,
} from "./handlers";
import { generateApiKey } from "./keys";

// Monday 12 Oct 2026, 10:00 in Prague (CEST, UTC+2)
const NOW = new Date("2026-10-12T08:00:00Z");
const BIZ: ApiBusiness = { id: "b1", name: "Kadeřnictví U Nůžek", slug: "u-nuzek", timezone: "Europe/Prague", slot_step_minutes: 15 };
const OTHER_BIZ: ApiBusiness = { ...BIZ, id: "b2", name: "Jiný podnik", slug: "jiny" };
const SERVICE: ApiService = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Pánský střih",
  description: null,
  duration_minutes: 60,
  price_czk: 450,
};
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const BASE = "https://rezervo.test/api/v1";

type Fixture = {
  key: string;
  store: ApiStore;
  bookings: Map<string, ApiBookingRecord & { businessId: string }>;
  created: CreateBookingResult[];
  nextCreateCode: string | null;
  background: Array<() => Promise<unknown>>;
  notified: { created: string[]; cancelled: string[] };
  limiter: { hits: Map<string, number>; denyBucket: string | null };
  storeError: Error | null;
};

function setup() {
  const { key, hash } = generateApiKey();
  const other = generateApiKey();

  const f: Fixture = {
    key,
    store: undefined as unknown as ApiStore,
    bookings: new Map(),
    created: [],
    nextCreateCode: null,
    background: [],
    notified: { created: [], cancelled: [] },
    limiter: { hits: new Map(), denyBucket: null },
    storeError: null,
  };

  const keys = new Map([
    [hash, { id: "k1", businessId: BIZ.id }],
    [other.hash, { id: "k2", businessId: OTHER_BIZ.id }],
  ]);
  const businesses = new Map([BIZ, OTHER_BIZ].map((b) => [b.id, b]));
  const check = () => {
    if (f.storeError) throw f.storeError;
  };

  f.store = {
    async findApiKey(h) {
      check();
      return keys.get(h) ?? null;
    },
    async touchApiKey() {},
    async getBusiness(id) {
      return businesses.get(id) ?? null;
    },
    async listServices(businessId) {
      check();
      return businessId === BIZ.id ? [SERVICE] : [];
    },
    async getOpeningHours(_businessId, weekday) {
      // Monday–Friday 09:00–17:00
      return weekday <= 5 ? { opens_at: "09:00:00", closes_at: "17:00:00" } : null;
    },
    async getBusyIntervals(businessId, from, to) {
      return [...f.bookings.values()]
        .filter((b) => b.businessId === businessId && b.status === "confirmed")
        .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) }))
        .filter((b) => b.start < to && b.end > from);
    },
    async createBooking({ businessId, serviceId, startsAt, customer }) {
      if (f.nextCreateCode) return { ok: false, code: f.nextCreateCode };
      const end = new Date(startsAt.getTime() + SERVICE.duration_minutes * 60_000);
      const clash = [...f.bookings.values()].some(
        (b) => b.businessId === businessId && b.status === "confirmed" && new Date(b.starts_at) < end && new Date(b.ends_at) > startsAt,
      );
      if (clash) return { ok: false, code: "slot_taken" };
      const id = `44444444-4444-4444-8444-${String(f.created.length).padStart(12, "0")}`;
      f.bookings.set(id, {
        id,
        businessId,
        status: "confirmed",
        starts_at: startsAt.toISOString(),
        ends_at: end.toISOString(),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        created_at: NOW.toISOString(),
        service: { id: serviceId, name: SERVICE.name, duration_minutes: 60, price_czk: 450 },
      });
      const result = { ok: true as const, id };
      f.created.push(result);
      return result;
    },
    async getBooking(businessId, id) {
      const b = f.bookings.get(id);
      if (!b || b.businessId !== businessId) return null;
      return {
        id: b.id,
        status: b.status,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        customer_name: b.customer_name,
        customer_email: b.customer_email,
        customer_phone: b.customer_phone,
        created_at: b.created_at,
        service: b.service,
      };
    },
    async cancelBooking(businessId, id) {
      const b = f.bookings.get(id);
      if (!b || b.businessId !== businessId || b.status !== "confirmed") return false;
      b.status = "cancelled";
      return true;
    },
  };

  const rateLimiter: RateLimiter = {
    async hit(bucket, limit, windowSeconds) {
      const count = (f.limiter.hits.get(bucket) ?? 0) + 1;
      f.limiter.hits.set(bucket, count);
      const allowed = f.limiter.denyBucket !== bucket && count <= limit;
      return { allowed, limit, remaining: allowed ? limit - count : 0, resetAt: new Date(NOW.getTime() + windowSeconds * 1000) };
    },
  };

  const api = createApiHandlers({
    store: f.store,
    rateLimiter,
    now: () => NOW,
    runInBackground: (task) => {
      f.background.push(task);
    },
    notifyBookingCreated: async (id) => {
      f.notified.created.push(id);
    },
    notifyBookingCancelled: async (id) => {
      f.notified.cancelled.push(id);
    },
  });

  const flush = async () => {
    while (f.background.length) await f.background.shift()!();
  };

  return { api, f, flush, otherKey: other.key };
}

function req(path: string, init: { method?: string; key?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.key) headers.set("authorization", `Bearer ${init.key}`);
  let body: string | undefined;
  if (init.body !== undefined) {
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  return new Request(`${BASE}${path}`, { method: init.method ?? "GET", headers, body });
}

async function json(res: Response) {
  return (await res.json()) as { data?: Record<string, unknown> & unknown[]; error?: { code: string; details?: unknown }; meta?: unknown };
}

function seedBooking(f: Fixture, id: string, businessId: string, startsAt: string, status: "confirmed" | "cancelled" = "confirmed") {
  const start = new Date(startsAt);
  f.bookings.set(id, {
    id,
    businessId,
    status,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 3600_000).toISOString(),
    customer_name: "Petr Svoboda",
    customer_email: "petr@example.cz",
    customer_phone: "777888999",
    created_at: NOW.toISOString(),
    service: { id: SERVICE.id, name: SERVICE.name, duration_minutes: 60, price_czk: 450 },
  });
}

const validBooking = {
  service_id: SERVICE.id,
  starts_at: "2026-10-13T10:00:00+02:00",
  customer: { name: "Jana Nováková", email: "Jana@Example.cz", phone: "+420 777 123 456" },
};

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});

describe("authentication", () => {
  it("requires the Authorization header", async () => {
    const res = await ctx.api.listServices(req("/services"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
    expect((await json(res)).error?.code).toBe("missing_api_key");
  });

  it("rejects a non-Bearer header", async () => {
    const res = await ctx.api.listServices(req("/services", { headers: { authorization: `Basic ${ctx.f.key}` } }));
    expect(res.status).toBe(401);
    expect((await json(res)).error?.code).toBe("invalid_authorization_header");
  });

  it("rejects malformed and unknown keys", async () => {
    for (const key of ["nonsense", generateApiKey().key]) {
      const res = await ctx.api.listServices(req("/services", { key }));
      expect(res.status).toBe(401);
      expect((await json(res)).error?.code).toBe("invalid_api_key");
    }
  });

  it("returns JSON 500 without leaking details when the store fails", async () => {
    ctx.f.storeError = new Error("connection refused to db.internal");
    const res = await ctx.api.listServices(req("/services", { key: ctx.f.key }));
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error?.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("db.internal");
  });
});

describe("rate limiting", () => {
  it("adds RateLimit headers to successful responses", async () => {
    const res = await ctx.api.listServices(req("/services", { key: ctx.f.key }));
    expect(res.status).toBe(200);
    expect(res.headers.get("ratelimit-limit")).toBe(String(RATE_LIMITS.all.limit));
    expect(res.headers.get("ratelimit-remaining")).toBe(String(RATE_LIMITS.all.limit - 1));
    expect(res.headers.get("ratelimit-reset")).toBe("60");
  });

  it("returns 429 with Retry-After once the limit is exceeded", async () => {
    ctx.f.limiter.hits.set("key:k1", RATE_LIMITS.all.limit);
    const res = await ctx.api.listServices(req("/services", { key: ctx.f.key }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await json(res)).error?.code).toBe("rate_limited");
  });

  it("applies the stricter write limit to bookings", async () => {
    ctx.f.limiter.denyBucket = "key:k1:write";
    const res = await ctx.api.createBooking(req("/bookings", { method: "POST", key: ctx.f.key, body: validBooking }));
    expect(res.status).toBe(429);
    expect(res.headers.get("ratelimit-limit")).toBe(String(RATE_LIMITS.write.limit));
    expect(ctx.f.created).toHaveLength(0);
  });

  it("counts limits per key", async () => {
    await ctx.api.listServices(req("/services", { key: ctx.f.key }));
    await ctx.api.listServices(req("/services", { key: ctx.otherKey }));
    expect(ctx.f.limiter.hits.get("key:k1")).toBe(1);
    expect(ctx.f.limiter.hits.get("key:k2")).toBe(1);
  });
});

describe("GET /services", () => {
  it("lists services of the key's business only", async () => {
    const res = await ctx.api.listServices(req("/services", { key: ctx.f.key }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await json(res);
    expect(body.data).toEqual([
      { id: SERVICE.id, name: "Pánský střih", description: null, duration_minutes: 60, price_czk: 450 },
    ]);
    expect(body.meta).toEqual({ business: { name: BIZ.name, slug: "u-nuzek", timezone: "Europe/Prague" } });

    const other = await json(await ctx.api.listServices(req("/services", { key: ctx.otherKey })));
    expect(other.data).toEqual([]);
  });
});

describe("GET /slots", () => {
  const slots = (query: string, key = ctx.f.key) => ctx.api.getSlots(req(`/slots?${query}`, { key }));

  it("returns all slots of a free day with local times", async () => {
    const res = await slots(`service_id=${SERVICE.id}&date=2026-10-13`);
    expect(res.status).toBe(200);
    const { data } = await json(res);
    const list = data!.slots as Array<{ starts_at: string; ends_at: string; local_time: string }>;
    // 09:00 … 16:00 every 15 minutes
    expect(list).toHaveLength(29);
    expect(list[0]).toEqual({ starts_at: "2026-10-13T07:00:00.000Z", ends_at: "2026-10-13T08:00:00.000Z", local_time: "09:00" });
    expect(list.at(-1)?.local_time).toBe("16:00");
    expect(data!.closed).toBe(false);
    expect(data!.timezone).toBe("Europe/Prague");
  });

  it("skips booked times", async () => {
    seedBooking(ctx.f, BOOKING_ID, BIZ.id, "2026-10-13T10:00:00+02:00");
    const { data } = await json(await slots(`service_id=${SERVICE.id}&date=2026-10-13`));
    const times = (data!.slots as Array<{ local_time: string }>).map((s) => s.local_time);
    expect(times).toHaveLength(22);
    expect(times).toContain("09:00");
    expect(times).not.toContain("09:15");
    expect(times).not.toContain("10:45");
    expect(times).toContain("11:00");
  });

  it("applies minimum notice today", async () => {
    const { data } = await json(await slots(`service_id=${SERVICE.id}&date=2026-10-12`));
    expect((data!.slots as Array<{ local_time: string }>)[0].local_time).toBe("10:30");
  });

  it("marks closed days", async () => {
    const { data } = await json(await slots(`service_id=${SERVICE.id}&date=2026-10-17`));
    expect(data!.closed).toBe(true);
    expect(data!.slots).toEqual([]);
  });

  it("validates query parameters", async () => {
    const res = await slots("service_id=abc&date=13.10.2026");
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error?.code).toBe("validation_error");
    expect(body.error?.details).toEqual([
      { field: "service_id", message: "Must be a UUID." },
      { field: "date", message: "Must be a valid date in format YYYY-MM-DD." },
    ]);
  });

  it("rejects dates outside the booking window", async () => {
    for (const date of ["2026-10-11", "2026-12-12"]) {
      const res = await slots(`service_id=${SERVICE.id}&date=${date}`);
      expect(res.status).toBe(422);
      const body = await json(res);
      expect(body.error?.code).toBe("date_out_of_range");
      expect(body.error?.details).toEqual({ min_date: "2026-10-12", max_date: "2026-12-11" });
    }
  });

  it("returns 404 for a service of another business", async () => {
    const res = await slots(`service_id=${SERVICE.id}&date=2026-10-13`, ctx.otherKey);
    expect(res.status).toBe(404);
    expect((await json(res)).error?.code).toBe("service_not_found");
  });
});

describe("POST /bookings", () => {
  const create = (body: unknown, headers?: Record<string, string>, key = ctx.f.key) =>
    ctx.api.createBooking(req("/bookings", { method: "POST", key, body, headers }));

  it("creates a booking and sends notifications after the response", async () => {
    const res = await create(validBooking);
    expect(res.status).toBe(201);
    const { data } = await json(res);
    expect(data).toMatchObject({
      status: "confirmed",
      starts_at: "2026-10-13T08:00:00.000Z",
      ends_at: "2026-10-13T09:00:00.000Z",
      local_date: "2026-10-13",
      local_time: "10:00",
      timezone: "Europe/Prague",
      service: { id: SERVICE.id, name: "Pánský střih", duration_minutes: 60, price_czk: 450 },
      customer: { name: "Jana Nováková", email: "jana@example.cz", phone: "+420 777 123 456" },
    });
    expect(res.headers.get("location")).toBe(`/api/v1/bookings/${data!.id}`);

    expect(ctx.f.notified.created).toEqual([]);
    await ctx.flush();
    expect(ctx.f.notified.created).toEqual([data!.id]);
  });

  it("returns 409 when the slot is already taken", async () => {
    expect((await create(validBooking)).status).toBe(201);
    const res = await create({ ...validBooking, starts_at: "2026-10-13T10:30:00+02:00" });
    expect(res.status).toBe(409);
    expect((await json(res)).error?.code).toBe("slot_taken");
  });

  it("requires a JSON content type", async () => {
    const res = await create(JSON.stringify(validBooking), { "content-type": "text/plain" });
    expect(res.status).toBe(415);
    expect((await json(res)).error?.code).toBe("unsupported_media_type");
  });

  it("rejects invalid JSON and oversized bodies", async () => {
    const bad = await create("{not json");
    expect(bad.status).toBe(400);
    expect((await json(bad)).error?.code).toBe("invalid_json");

    const big = await create({ ...validBooking, padding: "x".repeat(MAX_BODY_BYTES) });
    expect(big.status).toBe(413);
    expect((await json(big)).error?.code).toBe("payload_too_large");
  });

  it("returns field-level validation errors", async () => {
    const res = await create({ service_id: SERVICE.id, starts_at: "2026-10-13 10:00", customer: { name: "J" } });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error?.code).toBe("validation_error");
    expect((body.error?.details as Array<{ field: string }>).map((d) => d.field)).toEqual([
      "starts_at",
      "customer.name",
      "customer.email",
      "customer.phone",
    ]);
    expect(ctx.f.created).toHaveLength(0);
  });

  it("rejects unknown services and services of other businesses", async () => {
    const unknown = await create({ ...validBooking, service_id: "55555555-5555-4555-8555-555555555555" });
    expect(unknown.status).toBe(404);
    expect((await json(unknown)).error?.code).toBe("service_not_found");

    const foreign = await create(validBooking, undefined, ctx.otherKey);
    expect(foreign.status).toBe(404);
  });

  it("enforces past, minimum notice and booking window", async () => {
    const cases: Array<[string, string]> = [
      ["2026-10-12T09:00:00+02:00", "slot_in_past"],
      ["2026-10-12T10:15:00+02:00", "slot_too_soon"],
      ["2026-12-14T10:00:00+01:00", "date_out_of_range"],
    ];
    for (const [startsAt, code] of cases) {
      const res = await create({ ...validBooking, starts_at: startsAt });
      expect(res.status, code).toBe(422);
      expect((await json(res)).error?.code).toBe(code);
    }
  });

  it("maps database rule violations to clear errors", async () => {
    const cases: Array<[string, number, string]> = [
      ["outside_opening_hours", 422, "outside_opening_hours"],
      ["slot_misaligned", 422, "slot_misaligned"],
      ["slot_too_far", 422, "date_out_of_range"],
      ["service_not_found", 404, "service_not_found"],
    ];
    for (const [dbCode, status, code] of cases) {
      ctx.f.nextCreateCode = dbCode;
      const res = await create(validBooking);
      expect(res.status, dbCode).toBe(status);
      expect((await json(res)).error?.code).toBe(code);
    }
  });

  it("returns 500 for unexpected database errors", async () => {
    ctx.f.nextCreateCode = "something_new";
    const res = await create(validBooking);
    expect(res.status).toBe(500);
    expect((await json(res)).error?.code).toBe("internal_error");
  });
});

describe("POST /bookings/{id}/cancel", () => {
  const cancel = (id: string, key = ctx.f.key) => ctx.api.cancelBooking(req(`/bookings/${id}/cancel`, { method: "POST", key }), id);

  it("cancels a booking and notifies the customer", async () => {
    seedBooking(ctx.f, BOOKING_ID, BIZ.id, "2026-10-13T10:00:00+02:00");
    const res = await cancel(BOOKING_ID);
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ id: BOOKING_ID, status: "cancelled", local_time: "10:00" });
    expect(ctx.f.bookings.get(BOOKING_ID)?.status).toBe("cancelled");
    await ctx.flush();
    expect(ctx.f.notified.cancelled).toEqual([BOOKING_ID]);
  });

  it("frees the slot for new bookings", async () => {
    seedBooking(ctx.f, BOOKING_ID, BIZ.id, "2026-10-13T10:00:00+02:00");
    await cancel(BOOKING_ID);
    const res = await ctx.api.createBooking(req("/bookings", { method: "POST", key: ctx.f.key, body: validBooking }));
    expect(res.status).toBe(201);
  });

  it("returns 409 for an already cancelled booking", async () => {
    seedBooking(ctx.f, BOOKING_ID, BIZ.id, "2026-10-13T10:00:00+02:00", "cancelled");
    const res = await cancel(BOOKING_ID);
    expect(res.status).toBe(409);
    expect((await json(res)).error?.code).toBe("booking_already_cancelled");
    await ctx.flush();
    expect(ctx.f.notified.cancelled).toEqual([]);
  });

  it("refuses to cancel bookings that have started", async () => {
    seedBooking(ctx.f, BOOKING_ID, BIZ.id, "2026-10-12T09:30:00+02:00");
    const res = await cancel(BOOKING_ID);
    expect(res.status).toBe(409);
    expect((await json(res)).error?.code).toBe("booking_in_past");
  });

  it("returns 404 for unknown bookings and bookings of other businesses", async () => {
    seedBooking(ctx.f, OTHER_BOOKING_ID, OTHER_BIZ.id, "2026-10-13T10:00:00+02:00");
    for (const id of [BOOKING_ID, OTHER_BOOKING_ID]) {
      const res = await cancel(id);
      expect(res.status).toBe(404);
      expect((await json(res)).error?.code).toBe("booking_not_found");
    }
    expect(ctx.f.bookings.get(OTHER_BOOKING_ID)?.status).toBe("confirmed");
  });

  it("validates the booking ID", async () => {
    const res = await cancel("not-a-uuid");
    expect(res.status).toBe(400);
    expect((await json(res)).error?.code).toBe("validation_error");
  });

  it("requires authentication", async () => {
    seedBooking(ctx.f, BOOKING_ID, BIZ.id, "2026-10-13T10:00:00+02:00");
    const res = await ctx.api.cancelBooking(req(`/bookings/${BOOKING_ID}/cancel`, { method: "POST" }), BOOKING_ID);
    expect(res.status).toBe(401);
    expect(ctx.f.bookings.get(BOOKING_ID)?.status).toBe("confirmed");
  });
});
