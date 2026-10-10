// Framework-agnostic handlers of the public REST API (/api/v1). All I/O goes
// through `ApiDeps`, so the route files wire in Supabase and tests use fakes.

import { BOOKING_HORIZON_DAYS, MIN_NOTICE_MINUTES } from "@/lib/constants";
import { computeAvailableSlots, type Interval } from "@/lib/slots";
import { addDays, isoWeekday, minutesToTime, todayInTimeZone, toZoned, zonedTimeToUtc } from "@/lib/time";
import { hashApiKey, isWellFormedApiKey, parseBearer } from "./keys";
import { apiError, apiJson } from "./responses";
import { isUuid, validateCreateBooking, validateSlotsQuery } from "./validation";

export type ApiBusiness = { id: string; name: string; slug: string; timezone: string; slot_step_minutes: number };
export type ApiService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_czk: number;
};
export type ApiBookingRecord = {
  id: string;
  status: "confirmed" | "cancelled";
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  created_at: string;
  service: Pick<ApiService, "id" | "name" | "duration_minutes" | "price_czk"> | null;
};

export type CreateBookingResult = { ok: true; id: string } | { ok: false; code: string };

export interface ApiStore {
  /** Active (not revoked) key with the given hash. */
  findApiKey(hash: string): Promise<{ id: string; businessId: string } | null>;
  touchApiKey(keyId: string): Promise<void>;
  getBusiness(businessId: string): Promise<ApiBusiness | null>;
  /** Active services in display order. */
  listServices(businessId: string): Promise<ApiService[]>;
  getOpeningHours(businessId: string, weekday: number): Promise<{ opens_at: string; closes_at: string } | null>;
  /** Whether a closure (holiday) covers the calendar day */
  isClosedOn(businessId: string, date: string): Promise<boolean>;
  getBusyIntervals(businessId: string, from: Date, to: Date): Promise<Interval[]>;
  /** Atomic booking via create_booking(); `code` is its error (slot_taken, …). */
  createBooking(input: {
    businessId: string;
    serviceId: string;
    startsAt: Date;
    customer: { name: string; email: string; phone: string };
  }): Promise<CreateBookingResult>;
  getBooking(businessId: string, bookingId: string): Promise<ApiBookingRecord | null>;
  /** Cancels a confirmed booking; false when it wasn't confirmed anymore. */
  cancelBooking(businessId: string, bookingId: string): Promise<boolean>;
}

export type RateLimitResult = { allowed: boolean; limit: number; remaining: number; resetAt: Date };

export interface RateLimiter {
  hit(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

export type ApiDeps = {
  store: ApiStore;
  rateLimiter: RateLimiter;
  now: () => Date;
  /** Runs work after the response is sent (next/server `after` in production). */
  runInBackground: (task: () => Promise<unknown>) => void;
  notifyBookingCreated: (bookingId: string) => Promise<void>;
  notifyBookingCancelled: (bookingId: string) => Promise<void>;
};

export const RATE_LIMITS = {
  /** Every request, per API key. */
  all: { limit: 120, windowSeconds: 60 },
  /** Requests that create or cancel bookings, per API key. */
  write: { limit: 20, windowSeconds: 60 },
} as const;

export const MAX_BODY_BYTES = 10_000;

type Scope = "read" | "write";
type Context = { business: ApiBusiness; keyId: string };

const BOOKING_ERRORS: Record<string, { status: number; code: Parameters<typeof apiError>[1]; message: string }> = {
  slot_taken: { status: 409, code: "slot_taken", message: "The slot is no longer available. Fetch free slots again." },
  slot_in_past: { status: 422, code: "slot_in_past", message: "The slot is in the past." },
  slot_too_far: { status: 422, code: "date_out_of_range", message: "The slot is too far in the future." },
  outside_opening_hours: { status: 422, code: "outside_opening_hours", message: "The service doesn't fit into opening hours." },
  business_closed: { status: 422, code: "business_closed", message: "The business is closed on this day (holiday)." },
  slot_misaligned: { status: 422, code: "slot_misaligned", message: "Start time isn't one of the offered slot times." },
  service_not_found: { status: 404, code: "service_not_found", message: "Service not found or not active." },
};

function rateLimitHeaders(r: RateLimitResult, now: Date): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((r.resetAt.getTime() - now.getTime()) / 1000))),
  };
}

function bookableRange(timeZone: string, now: Date) {
  const from = todayInTimeZone(timeZone, now);
  return { from, to: addDays(from, BOOKING_HORIZON_DAYS) };
}

function serializeService(s: ApiService) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price_czk: s.price_czk,
  };
}

function serializeBooking(b: ApiBookingRecord, timeZone: string) {
  const local = toZoned(new Date(b.starts_at), timeZone);
  return {
    id: b.id,
    status: b.status,
    starts_at: new Date(b.starts_at).toISOString(),
    ends_at: new Date(b.ends_at).toISOString(),
    local_date: local.date,
    local_time: minutesToTime(local.minutes),
    timezone: timeZone,
    service: b.service,
    customer: { name: b.customer_name, email: b.customer_email, phone: b.customer_phone },
    created_at: new Date(b.created_at).toISOString(),
  };
}

export function createApiHandlers(deps: ApiDeps) {
  const { store, rateLimiter, now } = deps;

  /** Authentication, rate limiting and error boundary shared by all endpoints. */
  async function withApi(request: Request, scope: Scope, handler: (ctx: Context) => Promise<Response>) {
    try {
      const bearer = parseBearer(request.headers.get("authorization"));
      if (!bearer.ok) {
        return bearer.reason === "missing"
          ? apiError(401, "missing_api_key", "Send the API key in the header 'Authorization: Bearer <key>'.", {
              headers: { "WWW-Authenticate": "Bearer" },
            })
          : apiError(401, "invalid_authorization_header", "Expected the header format 'Authorization: Bearer <key>'.", {
              headers: { "WWW-Authenticate": "Bearer" },
            });
      }

      // Malformed keys are rejected without touching the database.
      const key = isWellFormedApiKey(bearer.key) ? await store.findApiKey(hashApiKey(bearer.key)) : null;
      if (!key) {
        return apiError(401, "invalid_api_key", "The API key is invalid or has been revoked.", {
          headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
        });
      }

      let limit = await rateLimiter.hit(`key:${key.id}`, RATE_LIMITS.all.limit, RATE_LIMITS.all.windowSeconds);
      if (limit.allowed && scope === "write") {
        const write = await rateLimiter.hit(`key:${key.id}:write`, RATE_LIMITS.write.limit, RATE_LIMITS.write.windowSeconds);
        if (!write.allowed || write.remaining < limit.remaining) limit = write;
      }
      const limitHeaders = rateLimitHeaders(limit, now());
      if (!limit.allowed) {
        return apiError(429, "rate_limited", "Too many requests. Retry after the time in the Retry-After header.", {
          headers: { ...limitHeaders, "Retry-After": limitHeaders["RateLimit-Reset"] },
        });
      }

      deps.runInBackground(() => store.touchApiKey(key.id));

      const business = await store.getBusiness(key.businessId);
      if (!business) {
        return apiError(401, "invalid_api_key", "The API key is invalid or has been revoked.", { headers: limitHeaders });
      }

      const response = await handler({ business, keyId: key.id });
      for (const [name, value] of Object.entries(limitHeaders)) response.headers.set(name, value);
      return response;
    } catch (err) {
      console.error("[api] Unhandled error", err);
      return apiError(500, "internal_error", "Something went wrong on our side. Try again later.");
    }
  }

  /** GET /api/v1/services */
  function listServices(request: Request) {
    return withApi(request, "read", async ({ business }) => {
      const services = await store.listServices(business.id);
      return apiJson({
        data: services.map(serializeService),
        meta: { business: { name: business.name, slug: business.slug, timezone: business.timezone } },
      });
    });
  }

  /** GET /api/v1/slots?service_id=<uuid>&date=YYYY-MM-DD */
  function getSlots(request: Request) {
    return withApi(request, "read", async ({ business }) => {
      const query = validateSlotsQuery(new URL(request.url).searchParams);
      if (!query.ok) return apiError(400, "validation_error", "Invalid query parameters.", { details: query.errors });
      const { serviceId, date } = query.value;

      const service = (await store.listServices(business.id)).find((s) => s.id === serviceId);
      if (!service) return apiError(404, "service_not_found", "Service not found or not active.");

      const current = now();
      const range = bookableRange(business.timezone, current);
      if (date < range.from || date > range.to) {
        return apiError(422, "date_out_of_range", `Bookings can be made from ${range.from} to ${range.to}.`, {
          details: { min_date: range.from, max_date: range.to },
        });
      }

      const [regularHours, holiday] = await Promise.all([
        store.getOpeningHours(business.id, isoWeekday(date)),
        store.isClosedOn(business.id, date),
      ]);
      const opening = holiday ? null : regularHours;
      const busy = opening
        ? await store.getBusyIntervals(
            business.id,
            zonedTimeToUtc(date, 0, business.timezone),
            zonedTimeToUtc(addDays(date, 1), 0, business.timezone),
          )
        : [];

      const slots = computeAvailableSlots({
        date,
        timeZone: business.timezone,
        opening,
        durationMinutes: service.duration_minutes,
        stepMinutes: business.slot_step_minutes,
        busy,
        now: current,
        minNoticeMinutes: MIN_NOTICE_MINUTES,
      });

      return apiJson({
        data: {
          date,
          timezone: business.timezone,
          closed: opening === null,
          ...(holiday ? { closed_reason: "holiday" } : regularHours === null ? { closed_reason: "regular" } : {}),
          service: { id: service.id, name: service.name, duration_minutes: service.duration_minutes },
          slots: slots.map((start) => ({
            starts_at: start.toISOString(),
            ends_at: new Date(start.getTime() + service.duration_minutes * 60_000).toISOString(),
            local_time: minutesToTime(toZoned(start, business.timezone).minutes),
          })),
        },
      });
    });
  }

  /** POST /api/v1/bookings */
  function createBooking(request: Request) {
    return withApi(request, "write", async ({ business }) => {
      const contentType = request.headers.get("content-type") ?? "";
      if (!/^application\/json\b/i.test(contentType)) {
        return apiError(415, "unsupported_media_type", "Send the body as JSON with 'Content-Type: application/json'.");
      }
      const declaredLength = Number(request.headers.get("content-length") ?? "0");
      if (declaredLength > MAX_BODY_BYTES) {
        return apiError(413, "payload_too_large", `The body must not exceed ${MAX_BODY_BYTES} bytes.`);
      }
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return apiError(413, "payload_too_large", `The body must not exceed ${MAX_BODY_BYTES} bytes.`);
      }

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return apiError(400, "invalid_json", "The body is not valid JSON.");
      }

      const input = validateCreateBooking(body);
      if (!input.ok) return apiError(400, "validation_error", "Invalid request body.", { details: input.errors });
      const { serviceId, startsAt, customer } = input.value;

      const service = (await store.listServices(business.id)).find((s) => s.id === serviceId);
      if (!service) return apiError(404, "service_not_found", "Service not found or not active.");

      // Same rules the public booking page applies; create_booking() re-checks the rest atomically.
      const current = now();
      if (startsAt.getTime() < current.getTime()) {
        return apiError(422, "slot_in_past", "The slot is in the past.");
      }
      if (startsAt.getTime() < current.getTime() + MIN_NOTICE_MINUTES * 60_000) {
        return apiError(422, "slot_too_soon", `Bookings must be made at least ${MIN_NOTICE_MINUTES} minutes in advance.`);
      }
      const range = bookableRange(business.timezone, current);
      if (toZoned(startsAt, business.timezone).date > range.to) {
        return apiError(422, "date_out_of_range", `Bookings can be made from ${range.from} to ${range.to}.`, {
          details: { min_date: range.from, max_date: range.to },
        });
      }

      const result = await store.createBooking({ businessId: business.id, serviceId, startsAt, customer });
      if (!result.ok) {
        const mapped = BOOKING_ERRORS[result.code];
        if (!mapped) throw new Error(`create_booking failed: ${result.code}`);
        return apiError(mapped.status, mapped.code, mapped.message);
      }

      deps.runInBackground(() => deps.notifyBookingCreated(result.id));

      const booking: ApiBookingRecord = {
        id: result.id,
        status: "confirmed",
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + service.duration_minutes * 60_000).toISOString(),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        created_at: current.toISOString(),
        service: { id: service.id, name: service.name, duration_minutes: service.duration_minutes, price_czk: service.price_czk },
      };
      return apiJson({ data: serializeBooking(booking, business.timezone) }, 201, {
        Location: `/api/v1/bookings/${result.id}`,
      });
    });
  }

  /** GET /api/v1/bookings/{id} */
  function getBooking(request: Request, bookingId: string) {
    return withApi(request, "read", async ({ business }) => {
      if (!isUuid(bookingId)) {
        return apiError(400, "validation_error", "Invalid booking ID.", {
          details: [{ field: "id", message: "Must be a UUID." }],
        });
      }
      const booking = await store.getBooking(business.id, bookingId.toLowerCase());
      if (!booking) return apiError(404, "booking_not_found", "Booking not found.");
      return apiJson({ data: serializeBooking(booking, business.timezone) });
    });
  }

  /** POST /api/v1/bookings/{id}/cancel */
  function cancelBooking(request: Request, bookingId: string) {
    return withApi(request, "write", async ({ business }) => {
      if (!isUuid(bookingId)) {
        return apiError(400, "validation_error", "Invalid booking ID.", {
          details: [{ field: "id", message: "Must be a UUID." }],
        });
      }
      const id = bookingId.toLowerCase();

      const booking = await store.getBooking(business.id, id);
      if (!booking) return apiError(404, "booking_not_found", "Booking not found.");
      if (booking.status === "cancelled") {
        return apiError(409, "booking_already_cancelled", "The booking has already been cancelled.");
      }
      if (new Date(booking.starts_at).getTime() <= now().getTime()) {
        return apiError(409, "booking_in_past", "Bookings that have already started can't be cancelled.");
      }

      // Guarded by status = 'confirmed', so a concurrent cancel can't notify twice.
      if (!(await store.cancelBooking(business.id, id))) {
        return apiError(409, "booking_already_cancelled", "The booking has already been cancelled.");
      }

      deps.runInBackground(() => deps.notifyBookingCancelled(id));
      return apiJson({ data: serializeBooking({ ...booking, status: "cancelled" }, business.timezone) });
    });
  }

  return { listServices, getSlots, createBooking, getBooking, cancelBooking };
}

export type ApiHandlers = ReturnType<typeof createApiHandlers>;
