import "server-only";

// The public demo account (see scripts/seed.mts and README) is shared by every visitor.
// Account-level changes that would lock others out or redirect e-mails are blocked in the
// app and undone hourly by /api/cron/demo-reset (someone could call Supabase directly).

export const DEMO_OWNER_EMAIL = "demo@rezervo.test";
export const DEMO_OWNER_PASSWORD = "demo-heslo-123";
export const DEMO_SLUG = "u-nuzek";

export const DEMO_LOCKED_MESSAGE =
  "V ukázkovém účtu nelze měnit heslo, adresu stránky, e-mail pro upozornění ani API klíč. Vše ostatní si klidně vyzkoušejte.";

export function isDemoOwner(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_OWNER_EMAIL;
}
