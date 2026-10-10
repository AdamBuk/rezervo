"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, isValidDateString, todayInTimeZone, zonedTimeToUtc } from "@/lib/time";
import type { ActionState } from "@/lib/constants";

const MAX_CLOSURE_DAYS = 366;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export async function addClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const startsOn = String(formData.get("starts_on") ?? "");
  const endsOnRaw = String(formData.get("ends_on") ?? "");
  const endsOn = endsOnRaw === "" ? startsOn : endsOnRaw;
  const note = String(formData.get("note") ?? "").trim();

  if (!isValidDateString(startsOn) || !isValidDateString(endsOn)) return { error: "Zadejte platné datum." };
  if (endsOn < startsOn) return { error: "Konec musí být stejný nebo pozdější den než začátek." };
  if (daysBetween(startsOn, endsOn) > MAX_CLOSURE_DAYS) return { error: "Zavřeno lze nastavit nejvýš na rok." };
  if (endsOn < todayInTimeZone(business.timezone)) return { error: "Toto období už proběhlo." };
  if (note.length > 100) return { error: "Poznámka může mít nejvýš 100 znaků." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("closures")
    .insert({ business_id: business.id, starts_on: startsOn, ends_on: endsOn, note: note || null });
  if (error) {
    console.error("[closures] insert failed", error);
    return { error: "Zavírací dny se nepodařilo uložit." };
  }

  // Existing bookings stay valid; tell the owner so they can contact the customers.
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .gte("starts_at", zonedTimeToUtc(startsOn, 0, business.timezone).toISOString())
    .lt("starts_at", zonedTimeToUtc(addDays(endsOn, 1), 0, business.timezone).toISOString());

  revalidatePath("/dashboard/hours");
  revalidatePath(`/${business.slug}`);
  return count
    ? {
        success: `Uloženo. Pozor: v tomto období už máte ${count} ${count === 1 ? "rezervaci" : count <= 4 ? "rezervace" : "rezervací"} – v kalendáři je zrušte nebo přesuňte.`,
      }
    : { success: "Zavírací dny uloženy. Zákazníkům se v tyto dny nenabídnou žádné termíny." };
}

export async function deleteClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closures")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id)
    .select("id");
  if (error || !data?.length) return { error: "Zavírací dny se nepodařilo odebrat." };

  revalidatePath("/dashboard/hours");
  revalidatePath(`/${business.slug}`);
  return { success: "Odebráno." };
}
