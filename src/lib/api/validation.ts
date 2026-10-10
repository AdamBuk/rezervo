import { isEmail } from "@/lib/format";
import { isValidDateString } from "@/lib/time";

export type FieldError = { field: string; message: string };

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// An explicit offset is required: "2026-10-14T10:00" would be ambiguous.
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/i;
// Same rule as the public booking form.
const PHONE_PATTERN = /^\+?[\d\s()-]{6,30}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Parses an ISO 8601 timestamp with an offset; returns null when invalid. */
export function parseIsoDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_DATETIME_PATTERN.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Reject rolled-over values such as 2026-02-30 by comparing the date part in the given offset.
  const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})/.exec(value) ?? [];
  const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(value);
  const offsetMinutes = offsetMatch
    ? (offsetMatch[1] === "-" ? -1 : 1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
    : 0;
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  if (local.getUTCFullYear() !== Number(y) || local.getUTCMonth() + 1 !== Number(m) || local.getUTCDate() !== Number(d)) {
    return null;
  }
  return date;
}

export type SlotsQuery = { serviceId: string; date: string };

export function validateSlotsQuery(params: URLSearchParams): Validated<SlotsQuery> {
  const errors: FieldError[] = [];
  const serviceId = params.get("service_id");
  const date = params.get("date");

  if (!serviceId) errors.push({ field: "service_id", message: "Required." });
  else if (!isUuid(serviceId)) errors.push({ field: "service_id", message: "Must be a UUID." });

  if (!date) errors.push({ field: "date", message: "Required, format YYYY-MM-DD." });
  else if (!isValidDateString(date)) errors.push({ field: "date", message: "Must be a valid date in format YYYY-MM-DD." });

  if (errors.length || !serviceId || !date) return { ok: false, errors };
  return { ok: true, value: { serviceId: serviceId.toLowerCase(), date } };
}

export type CreateBookingInput = {
  serviceId: string;
  startsAt: Date;
  customer: { name: string; email: string; phone: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCreateBooking(body: unknown): Validated<CreateBookingInput> {
  if (!isRecord(body)) return { ok: false, errors: [{ field: "body", message: "Must be a JSON object." }] };

  const errors: FieldError[] = [];

  const serviceId = body.service_id;
  if (!isUuid(serviceId)) errors.push({ field: "service_id", message: "Required, must be a UUID." });

  const startsAt = parseIsoDateTime(body.starts_at);
  if (!startsAt) {
    errors.push({
      field: "starts_at",
      message: "Required, ISO 8601 date-time with offset, e.g. 2026-10-14T10:00:00+02:00.",
    });
  }

  const customer = isRecord(body.customer) ? body.customer : null;
  if (!customer) errors.push({ field: "customer", message: "Required object with name, email and phone." });

  const name = typeof customer?.name === "string" ? customer.name.trim() : "";
  const email = typeof customer?.email === "string" ? customer.email.trim().toLowerCase() : "";
  const phone = typeof customer?.phone === "string" ? customer.phone.trim() : "";

  if (customer) {
    if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
      errors.push({ field: "customer.name", message: "Required, 2–100 characters, no control characters." });
    }
    if (email.length > 254 || !isEmail(email)) {
      errors.push({ field: "customer.email", message: "Required, must be a valid e-mail address." });
    }
    if (!PHONE_PATTERN.test(phone)) {
      errors.push({ field: "customer.phone", message: "Required, 6–30 digits, spaces, (), - and an optional leading +." });
    }
  }

  if (errors.length || !isUuid(serviceId) || !startsAt) return { ok: false, errors };
  return { ok: true, value: { serviceId: serviceId.toLowerCase(), startsAt, customer: { name, email, phone } } };
}
