"use server";

import { after } from "next/server";
import { getPublicBusiness } from "@/lib/availability";
import { createPublicClient } from "@/lib/supabase/public";
import { isEmail } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { notifyBookingCreated } from "@/lib/notifications";
import { bookingManageToken, getBookingLinkSecret } from "@/lib/booking-link";
import { isRateLimitedByIp } from "@/lib/rate-limit";
import { isUuid, isValidCustomerName, isValidPhone } from "@/lib/validation";

/** Per visitor IP: generous for real customers (incl. retries after "slot taken"), stops scripted spam. */
const BOOKING_LIMIT = { limit: 8, windowSeconds: 600 } as const;

export type BookingState =
  | { status: "idle" }
  | { status: "error"; error: string; slotTaken?: boolean }
  | {
      status: "success";
      bookingId: string;
      serviceName: string;
      durationMinutes: number;
      startsAt: string;
      /** Set when the customer chose a specific staff member */
      staffName: string | null;
      email: string;
      /** Relative manage/cancel link, when links are configured */
      managePath: string | null;
    };

const DB_ERRORS: Record<string, string> = {
  slot_taken: "Tento termín si mezitím zarezervoval někdo jiný. Vyberte prosím jiný čas.",
  slot_in_past: "Vybraný termín už proběhl. Vyberte prosím jiný čas.",
  slot_too_far: "Tak daleko dopředu zatím rezervace nepřijímáme.",
  outside_opening_hours: "Vybraný termín je mimo otevírací dobu.",
  business_closed: "V tento den má podnik zavřeno. Vyberte prosím jiný den.",
  slot_misaligned: "Vybraný čas není platný. Obnovte stránku a zkuste to znovu.",
  service_not_found: "Vybraná služba už není k dispozici.",
  staff_not_found: "Vybraný pracovník tuto službu už nenabízí. Vyberte prosím jiného.",
  business_not_found: "Podnik nebyl nalezen.",
};

export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  // Honeypot: real users never see or fill this field.
  if (formData.get("website")) return { status: "error", error: "Rezervaci se nepodařilo odeslat." };

  const slug = String(formData.get("slug") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "") || null;
  const startsAt = String(formData.get("starts_at") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!isValidCustomerName(name)) return { status: "error", error: "Vyplňte prosím jméno a příjmení." };
  if (!isEmail(email)) return { status: "error", error: "Zadejte platný e-mail." };
  if (!isValidPhone(phone)) return { status: "error", error: "Zadejte platné telefonní číslo." };
  if (Number.isNaN(Date.parse(startsAt))) return { status: "error", error: "Vyberte termín." };
  if (staffId !== null && !isUuid(staffId)) return { status: "error", error: DB_ERRORS.staff_not_found };

  if (await isRateLimitedByIp("booking", BOOKING_LIMIT.limit, BOOKING_LIMIT.windowSeconds)) {
    return { status: "error", error: "Odeslali jste příliš mnoho rezervací. Zkuste to prosím za pár minut znovu." };
  }

  const data = await getPublicBusiness(slug);
  const service = data?.services.find((s) => s.id === serviceId);
  if (!data || !service) return { status: "error", error: DB_ERRORS.service_not_found };
  const staffMember = staffId ? data.staff.find((m) => m.id === staffId) : null;
  if (staffId && (!staffMember || !data.staffByService[service.id].includes(staffId))) {
    return { status: "error", error: DB_ERRORS.staff_not_found };
  }

  const supabase = createPublicClient();
  const { data: bookingId, error } = await supabase.rpc("create_booking", {
    p_business_id: data.business.id,
    p_service_id: serviceId,
    p_starts_at: new Date(startsAt).toISOString(),
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone,
    p_staff_id: staffId,
  });

  if (error || !bookingId) {
    const code = error?.message ?? "";
    return {
      status: "error",
      error: DB_ERRORS[code] ?? "Rezervaci se nepodařilo dokončit. Zkuste to prosím znovu.",
      slotTaken: code === "slot_taken",
    };
  }

  const siteUrl = await getSiteUrl();
  after(() => notifyBookingCreated(bookingId, siteUrl));

  const token = bookingManageToken(bookingId, getBookingLinkSecret());
  return {
    status: "success",
    bookingId,
    serviceName: service.name,
    durationMinutes: service.duration_minutes,
    startsAt,
    staffName: staffMember?.name ?? null,
    email,
    managePath: token ? `/rezervace/${bookingId}/${token}` : null,
  };
}
