import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { notifyBookingCancelled, notifyBookingCreated } from "@/lib/notifications";
import { apiError } from "./responses";
import { createSupabaseRateLimiter } from "@/lib/rate-limit";
import { groupBusyByStaff } from "@/lib/slots";
import { createApiHandlers, type ApiDeps, type ApiHandlers, type ApiStore } from "./handlers";

// The API authenticates with its own keys, not Supabase sessions, so it uses the
// secret-key client. Every query below is scoped by the business_id resolved
// from the verified API key.

/** Skip writing last_used_at more often than this. */
const TOUCH_INTERVAL_MS = 60_000;

/** Created on first use, so requests rejected before any query don't need the secret key. */
function lazyAdminClient() {
  let client: ReturnType<typeof createAdminClient> | null = null;
  return () => (client ??= createAdminClient());
}

function createSupabaseStore(): ApiStore {
  const admin = lazyAdminClient();

  return {
    async findApiKey(hash) {
      const { data, error } = await admin()
        .from("api_keys")
        .select("id, business_id")
        .eq("key_hash", hash)
        .is("revoked_at", null)
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, businessId: data.business_id } : null;
    },

    async touchApiKey(keyId) {
      const threshold = new Date(Date.now() - TOUCH_INTERVAL_MS).toISOString();
      const { error } = await admin()
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyId)
        .or(`last_used_at.is.null,last_used_at.lt.${threshold}`);
      if (error) console.error("[api] touchApiKey failed", error);
    },

    async getBusiness(businessId) {
      const { data, error } = await admin()
        .from("businesses")
        .select("id, name, slug, timezone, slot_step_minutes")
        .eq("id", businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async listServices(businessId) {
      const { data, error } = await admin()
        .from("services")
        .select("id, name, description, duration_minutes, price_czk")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },

    async getOpeningHours(businessId, weekday) {
      const { data, error } = await admin()
        .from("opening_hours")
        .select("opens_at, closes_at")
        .eq("business_id", businessId)
        .eq("weekday", weekday)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async isClosedOn(businessId, date) {
      const { data, error } = await admin()
        .from("closures")
        .select("id")
        .eq("business_id", businessId)
        .lte("starts_on", date)
        .gte("ends_on", date)
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },

    async listStaff(businessId) {
      const { data, error } = await admin()
        .from("staff")
        .select("id, name, staff_services(service_id)")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at")
        .order("id");
      if (error) throw error;
      return (data ?? []).map((m) => ({ id: m.id, name: m.name, service_ids: m.staff_services.map((l) => l.service_id) }));
    },

    async getStaffBusy(businessId, staffIds, from, to) {
      const { data, error } = await admin().rpc("get_staff_busy_intervals", {
        p_business_id: businessId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return groupBusyByStaff(staffIds, data ?? []);
    },

    async createBooking({ businessId, serviceId, staffId, startsAt, customer }) {
      const { data, error } = await admin().rpc("create_booking", {
        p_business_id: businessId,
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_starts_at: startsAt.toISOString(),
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
      });
      // create_booking() raises its documented codes with SQLSTATE P0001.
      if (error) {
        if (error.code === "P0001") return { ok: false, code: error.message };
        throw error;
      }
      if (!data) throw new Error("create_booking returned no id");
      return { ok: true, id: data };
    },

    async getBooking(businessId, bookingId) {
      const { data, error } = await admin()
        .from("bookings")
        .select(
          "id, status, starts_at, ends_at, customer_name, customer_email, customer_phone, created_at, service:services(id, name, duration_minutes, price_czk), staff(id, name)",
        )
        .eq("id", bookingId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async cancelBooking(businessId, bookingId) {
      const { data, error } = await admin()
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .eq("business_id", businessId)
        .eq("status", "confirmed")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  };
}

/** API handlers wired to Supabase, Resend notifications and next/server `after`. */
async function getApiHandlers(): Promise<ApiHandlers> {
  // Resolved while the request is active; notifications run later inside after().
  const siteUrl = await getSiteUrl();
  const deps: ApiDeps = {
    store: createSupabaseStore(),
    rateLimiter: createSupabaseRateLimiter(),
    now: () => new Date(),
    runInBackground: (task) => after(task),
    notifyBookingCreated: (id) => notifyBookingCreated(id, siteUrl),
    notifyBookingCancelled: (id) => notifyBookingCancelled(id, siteUrl),
  };
  return createApiHandlers(deps);
}

/** Entry point for route files; also turns setup failures (e.g. a missing secret key) into a JSON 500. */
export async function runApi(handle: (api: ApiHandlers) => Promise<Response>): Promise<Response> {
  try {
    return await handle(await getApiHandlers());
  } catch (err) {
    console.error("[api] Setup failed", err);
    return apiError(500, "internal_error", "Something went wrong on our side. Try again later.");
  }
}
