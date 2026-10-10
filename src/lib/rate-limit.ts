import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RateLimiter } from "@/lib/api/handlers";

/**
 * Fixed-window limiter backed by Postgres (api_rate_limit_hit), so limits hold
 * across serverless instances. Fails open: an unavailable limiter (e.g. missing
 * secret key, DB hiccup) must not block bookings.
 */
export function createSupabaseRateLimiter(): RateLimiter {
  let client: ReturnType<typeof createAdminClient> | null = null;
  return {
    async hit(bucket, limit, windowSeconds) {
      const open = { allowed: true, limit, remaining: limit, resetAt: new Date(Date.now() + windowSeconds * 1000) };
      try {
        client ??= createAdminClient();
        const { data, error } = await client
          .rpc("api_rate_limit_hit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds })
          .single();
        if (error || !data) {
          console.error("[rate-limit] Limiter unavailable", error);
          return open;
        }
        return { allowed: data.allowed, limit, remaining: data.remaining, resetAt: new Date(data.reset_at) };
      } catch (err) {
        console.error("[rate-limit] Limiter unavailable", err);
        return open;
      }
    },
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip); null when unknown. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || null;
}

/**
 * Counts one attempt for the visitor's IP and reports whether they're over the limit.
 * Without a known IP the check is skipped: a shared "unknown" bucket would make
 * all visitors block each other.
 */
export async function isRateLimitedByIp(scope: string, limit: number, windowSeconds: number): Promise<boolean> {
  const ip = await getClientIp();
  if (!ip) return false;
  const result = await createSupabaseRateLimiter().hit(`${scope}:ip:${ip}`, limit, windowSeconds);
  return !result.allowed;
}
