import type { FieldError } from "./validation";

export type ApiErrorCode =
  | "missing_api_key"
  | "invalid_authorization_header"
  | "invalid_api_key"
  | "rate_limited"
  | "validation_error"
  | "invalid_json"
  | "unsupported_media_type"
  | "payload_too_large"
  | "not_found"
  | "service_not_found"
  | "booking_not_found"
  | "date_out_of_range"
  | "slot_in_past"
  | "slot_too_soon"
  | "outside_opening_hours"
  | "slot_misaligned"
  | "slot_taken"
  | "booking_already_cancelled"
  | "booking_in_past"
  | "internal_error";

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; details?: FieldError[] | Record<string, unknown> };
};

const BASE_HEADERS = { "Cache-Control": "no-store" } as const;

export function apiJson<T>(body: T, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...BASE_HEADERS, ...Object.fromEntries(new Headers(headers)) } });
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options: { details?: ApiErrorBody["error"]["details"]; headers?: HeadersInit } = {},
): Response {
  const body: ApiErrorBody = { error: { code, message, ...(options.details ? { details: options.details } : {}) } };
  return apiJson(body, status, options.headers);
}
