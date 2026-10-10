// Input rules shared by the booking form, the public API and customer links,
// so all entry points validate the same way.

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Control characters (incl. CR/LF) never belong in names or headers. */
export const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
export const PHONE_PATTERN = /^\+?[\d\s()-]{6,30}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isValidCustomerName(name: string): boolean {
  return name.length >= 2 && name.length <= 100 && !CONTROL_CHARS.test(name);
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}
