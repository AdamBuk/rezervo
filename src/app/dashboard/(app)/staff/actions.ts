"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, type ActionState } from "@/lib/constants";
import { trimSeconds } from "@/lib/format";
import { isUuid } from "@/lib/validation";

/** Sanity cap; far above what a small business needs. */
const MAX_STAFF = 30;
const LAST_ACTIVE_ERROR = "Alespoň jeden pracovník musí zůstat aktivní, jinak by nešlo nic zarezervovat.";

type StaffFields = { name: string; serviceIds: string[] };

function readStaffFields(formData: FormData): StaffFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Zadejte jméno (max. 60 znaků)." };
  const serviceIds = [...new Set(formData.getAll("service_ids").map(String))].filter(isUuid);
  return { name, serviceIds };
}

function revalidate(slug: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${slug}`);
}

/** Keeps only services of this business (the DB trigger would reject others anyway). */
async function ownServiceIds(businessId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id").eq("business_id", businessId).in("id", ids);
  return (data ?? []).map((s) => s.id);
}

async function activeStaffCount(businessId: string, excludeId?: string): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("staff").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("is_active", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { count } = await query;
  return count ?? 0;
}

export async function createStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const fields = readStaffFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  if ((count ?? 0) >= MAX_STAFF) return { error: `Maximální počet pracovníků je ${MAX_STAFF}.` };

  const { data: member, error } = await supabase
    .from("staff")
    .insert({ business_id: business.id, name: fields.name, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: "Pracovníka se nepodařilo přidat." };

  const serviceIds = await ownServiceIds(business.id, fields.serviceIds);
  if (serviceIds.length) {
    const { error: linkError } = await supabase
      .from("staff_services")
      .insert(serviceIds.map((service_id) => ({ staff_id: member.id, service_id })));
    if (linkError) return { error: "Pracovník byl přidán, ale služby se nepodařilo uložit. Upravte je prosím." };
  }

  revalidate(business.slug);
  return { success: `${fields.name} je v týmu.` };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
type ShiftRow = { weekday: number; opens_at: string; closes_at: string };

/** Own schedule from the form, validated against opening hours; null = follows opening hours. */
async function readSchedule(formData: FormData, businessId: string): Promise<ShiftRow[] | null | { error: string }> {
  if (formData.get("uses_business_hours") === "on") return null;

  const supabase = await createClient();
  const { data: opening } = await supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("business_id", businessId);
  const rows: ShiftRow[] = [];
  for (const day of WEEKDAYS) {
    if (formData.get(`work_${day.iso}`) !== "on") continue;
    const opensAt = String(formData.get(`opens_${day.iso}`) ?? "");
    const closesAt = String(formData.get(`closes_${day.iso}`) ?? "");
    if (!TIME.test(opensAt) || !TIME.test(closesAt)) return { error: `${day.label}: zadejte platný čas.` };
    if (closesAt <= opensAt) return { error: `${day.label}: konec musí být po začátku.` };
    const open = (opening ?? []).find((h) => h.weekday === day.iso);
    if (!open) return { error: `${day.label}: podnik má zavřeno, pracovní dobu nelze nastavit.` };
    if (opensAt < open.opens_at.slice(0, 5) || closesAt > open.closes_at.slice(0, 5)) {
      return { error: `${day.label}: pracovní doba musí být v rámci otevírací doby (${trimSeconds(open.opens_at)}–${trimSeconds(open.closes_at)}).` };
    }
    rows.push({ weekday: day.iso, opens_at: opensAt, closes_at: closesAt });
  }
  if (!rows.length) return { error: "Vyberte aspoň jeden pracovní den, nebo pracovníka deaktivujte." };
  return rows;
}

export async function updateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Pracovník nebyl nalezen." };
  const fields = readStaffFields(formData);
  if ("error" in fields) return fields;
  const isActive = formData.get("is_active") === "on";
  const schedule = await readSchedule(formData, business.id);
  if (schedule && "error" in schedule) return schedule;

  if (!isActive && (await activeStaffCount(business.id, id)) === 0) return { error: LAST_ACTIVE_ERROR };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("staff")
    .update({ name: fields.name, is_active: isActive, uses_business_hours: schedule === null })
    .eq("id", id)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error || !updated) return { error: "Změny se nepodařilo uložit." };

  // Replace the service assignments: remove unchecked, add checked.
  const serviceIds = await ownServiceIds(business.id, fields.serviceIds);
  let unlink = supabase.from("staff_services").delete().eq("staff_id", id);
  if (serviceIds.length) unlink = unlink.not("service_id", "in", `(${serviceIds.join(",")})`);
  const { error: unlinkError } = await unlink;
  const { error: linkError } = serviceIds.length
    ? await supabase
        .from("staff_services")
        .upsert(
          serviceIds.map((service_id) => ({ staff_id: id, service_id })),
          { onConflict: "staff_id,service_id", ignoreDuplicates: true },
        )
    : { error: null };
  if (unlinkError || linkError) return { error: "Služby pracovníka se nepodařilo uložit." };

  // Replace the schedule; while uses_business_hours is true the rows are simply unused.
  const { error: clearError } = await supabase.from("staff_hours").delete().eq("staff_id", id);
  const { error: hoursError } = schedule?.length
    ? await supabase.from("staff_hours").insert(schedule.map((r) => ({ staff_id: id, ...r })))
    : { error: null };
  if (clearError || hoursError) return { error: "Pracovní dobu se nepodařilo uložit." };

  revalidate(business.slug);
  return { success: "Uloženo." };
}

export async function deleteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Pracovník nebyl nalezen." };
  if ((await activeStaffCount(business.id, id)) === 0) return { error: LAST_ACTIVE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.from("staff").delete().eq("id", id).eq("business_id", business.id);
  // Staff with bookings can't be deleted (FK restrict) – deactivate instead, history stays intact.
  if (error?.code === "23503") {
    await supabase.from("staff").update({ is_active: false }).eq("id", id).eq("business_id", business.id);
    revalidate(business.slug);
    return { success: "Pracovník má rezervace, proto byl jen deaktivován (zůstává v historii kalendáře)." };
  }
  if (error) return { error: "Pracovníka se nepodařilo smazat." };

  revalidate(business.slug);
  return undefined;
}
