"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBookingManageToken } from "@/lib/booking-link";
import { CUSTOMER_CANCEL_NOTICE_HOURS } from "@/lib/constants";
import { notifyBookingCancelledByCustomer } from "@/lib/notifications";
import { createSupabaseRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";

export type CancelState = { status: "idle" } | { status: "error"; error: string } | { status: "cancelled" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cancelOwnBooking(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const id = String(formData.get("id") ?? "").toLowerCase();
  const token = String(formData.get("token") ?? "");
  if (!UUID.test(id) || !verifyBookingManageToken(id, token, process.env.API_KEY_ENCRYPTION_SECRET)) {
    return { status: "error", error: "Odkaz není platný. Otevřete ho prosím znovu z e-mailu." };
  }

  const limit = await createSupabaseRateLimiter().hit(`cancel:ip:${await getClientIp()}`, 10, 600);
  if (!limit.allowed) return { status: "error", error: "Příliš mnoho pokusů. Zkuste to prosím za pár minut." };

  // The token proves the customer got the link for this booking, so the
  // privileged client is safe here: the update is scoped to this one id.
  const cutoff = new Date(Date.now() + CUSTOMER_CANCEL_NOTICE_HOURS * 3600_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "confirmed")
    .gt("starts_at", cutoff)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[cancel-own] failed", error);
    return { status: "error", error: "Rezervaci se nepodařilo zrušit. Zkuste to prosím znovu." };
  }
  if (!data) {
    return {
      status: "error",
      error: `Rezervaci už nelze zrušit online – je zrušená, nebo do ní zbývá méně než ${CUSTOMER_CANCEL_NOTICE_HOURS} hodiny. Kontaktujte prosím podnik telefonicky.`,
    };
  }

  const siteUrl = await getSiteUrl();
  after(() => notifyBookingCancelledByCustomer(id, siteUrl));
  return { status: "cancelled" };
}
