"use server";

import { getPublicBusiness } from "@/lib/availability";
import { createPublicClient } from "@/lib/supabase/public";
import { isEmail } from "@/lib/format";

export type BookingState =
  | { status: "idle" }
  | { status: "error"; error: string; slotTaken?: boolean }
  | { status: "success"; bookingId: string; serviceName: string; startsAt: string; email: string };

const DB_ERRORS: Record<string, string> = {
  slot_taken: "Tento termín si mezitím zarezervoval někdo jiný. Vyberte prosím jiný čas.",
  slot_in_past: "Vybraný termín už proběhl. Vyberte prosím jiný čas.",
  slot_too_far: "Tak daleko dopředu zatím rezervace nepřijímáme.",
  outside_opening_hours: "Vybraný termín je mimo otevírací dobu.",
  slot_misaligned: "Vybraný čas není platný. Obnovte stránku a zkuste to znovu.",
  service_not_found: "Vybraná služba už není k dispozici.",
  business_not_found: "Podnik nebyl nalezen.",
};

export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  // Honeypot: real users never see or fill this field.
  if (formData.get("website")) return { status: "error", error: "Rezervaci se nepodařilo odeslat." };

  const slug = String(formData.get("slug") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2 || name.length > 100) return { status: "error", error: "Vyplňte prosím jméno a příjmení." };
  if (!isEmail(email)) return { status: "error", error: "Zadejte platný e-mail." };
  if (!/^\+?[\d\s()-]{6,30}$/.test(phone)) return { status: "error", error: "Zadejte platné telefonní číslo." };
  if (Number.isNaN(Date.parse(startsAt))) return { status: "error", error: "Vyberte termín." };

  const data = await getPublicBusiness(slug);
  const service = data?.services.find((s) => s.id === serviceId);
  if (!data || !service) return { status: "error", error: DB_ERRORS.service_not_found };

  const supabase = createPublicClient();
  const { data: bookingId, error } = await supabase.rpc("create_booking", {
    p_business_id: data.business.id,
    p_service_id: serviceId,
    p_starts_at: new Date(startsAt).toISOString(),
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone,
  });

  if (error || !bookingId) {
    const code = error?.message ?? "";
    return {
      status: "error",
      error: DB_ERRORS[code] ?? "Rezervaci se nepodařilo dokončit. Zkuste to prosím znovu.",
      slotTaken: code === "slot_taken",
    };
  }

  return { status: "success", bookingId, serviceName: service.name, startsAt, email };
}
