/** ISO weekdays (1 = Monday) with Czech labels. */
export const WEEKDAYS = [
  { iso: 1, label: "Pondělí", short: "Po" },
  { iso: 2, label: "Úterý", short: "Út" },
  { iso: 3, label: "Středa", short: "St" },
  { iso: 4, label: "Čtvrtek", short: "Čt" },
  { iso: 5, label: "Pátek", short: "Pá" },
  { iso: 6, label: "Sobota", short: "So" },
  { iso: 7, label: "Neděle", short: "Ne" },
] as const;

/** Must stay in sync with the businesses_slug_check constraint. */
export const RESERVED_SLUGS = ["login", "register", "logout", "dashboard", "auth", "api", "admin", "about"];

export const SLOT_STEPS = [5, 10, 15, 20, 30, 60] as const;

export const DEFAULT_TIMEZONE = "Europe/Prague";

/** How far ahead customers can book (must not exceed the 90 days enforced by create_booking). */
export const BOOKING_HORIZON_DAYS = 60;

/** Customers can't book a slot starting sooner than this. */
export const MIN_NOTICE_MINUTES = 30;

export type ActionState = { error?: string; success?: string } | undefined;
