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

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}
