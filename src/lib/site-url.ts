import "server-only";
import { headers } from "next/headers";

/** Absolute base URL of the app, used in auth redirects and e-mail links. */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  } catch {
    // Outside of a request (e.g. cron) – fall through.
  }
  return "http://localhost:3000";
}
