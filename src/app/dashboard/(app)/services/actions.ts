"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/constants";

type ServiceFields = {
  name: string;
  description: string | null;
  duration_minutes: number;
  price_czk: number;
};

function readServiceFields(formData: FormData): ServiceFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const duration = Number(formData.get("duration_minutes"));
  const price = Number(formData.get("price_czk"));

  if (!name || name.length > 100) return { error: "Zadejte název služby (max. 100 znaků)." };
  if (description && description.length > 300) return { error: "Popis může mít nejvýše 300 znaků." };
  if (!Number.isInteger(duration) || duration < 5 || duration > 480 || duration % 5 !== 0) {
    return { error: "Délka musí být 5 až 480 minut, v násobcích 5." };
  }
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return { error: "Zadejte cenu v celých korunách." };

  return { name, description, duration_minutes: duration, price_czk: price };
}

function revalidate(slug: string) {
  revalidatePath("/dashboard/services");
  revalidatePath(`/${slug}`);
}

export async function createService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const fields = readServiceFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  const { error } = await supabase
    .from("services")
    .insert({ ...fields, business_id: business.id, sort_order: count ?? 0 });
  if (error) return { error: "Službu se nepodařilo přidat." };

  revalidate(business.slug);
  return { success: `Služba „${fields.name}“ byla přidána.` };
}

export async function updateService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id"));
  const fields = readServiceFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ ...fields, is_active: formData.get("is_active") === "on" })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { error: "Změny se nepodařilo uložit." };

  revalidate(business.slug);
  return { success: "Uloženo." };
}

export async function deleteService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase.from("services").delete().eq("id", id).eq("business_id", business.id);

  // Services with existing bookings can't be deleted (FK restrict) – hide them instead.
  if (error?.code === "23503") {
    await supabase.from("services").update({ is_active: false }).eq("id", id).eq("business_id", business.id);
    revalidate(business.slug);
    return { success: "Služba má rezervace, proto byla jen skryta z rezervační stránky." };
  }
  if (error) return { error: "Službu se nepodařilo smazat." };

  revalidate(business.slug);
  return undefined;
}
