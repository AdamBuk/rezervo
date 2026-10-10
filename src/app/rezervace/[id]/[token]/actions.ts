"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingLinkSecret, verifyBookingManageToken } from "@/lib/booking-link";
import { CUSTOMER_CANCEL_NOTICE_HOURS } from "@/lib/constants";
import { notifyBookingCancelledByCustomer } from "@/lib/notifications";
import { isRateLimitedByIp } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";
import { isUuid } from "@/lib/validation";

export type CancelState = { status: "idle" } | { status: "error"; error: string } | { status: "cancelled" };

export async function cancelOwnBooking(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const id = String(formData.get("id") ?? "").toLowerCase();
  const token = String(formData.get("token") ?? "");
  if (!isUuid(id) || !verifyBookingManageToken(id, token, getBookingLinkSecret())) {
    return { status: "error", error: "Odkaz není platný. Otevřete ho prosím znovu z e-mailu." };
  }

  if (await isRateLimitedByIp("cancel", 10, 600)) {
    return { status: "error", error: "Příliš mnoho pokusů. Zkuste to prosím za pár minut." };
  }

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
