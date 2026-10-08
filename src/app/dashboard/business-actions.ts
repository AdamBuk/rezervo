"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnBusiness, requireBusiness, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isEmail, validateSlug } from "@/lib/format";
import { SLOT_STEPS, type ActionState } from "@/lib/constants";

type BusinessFields = {
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
};

function readBusinessFields(formData: FormData): BusinessFields | { error: string } {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const optional = (key: string) => text(key) || null;

  const name = text("name");
  const slug = text("slug").toLowerCase();

  if (name.length < 2 || name.length > 100) return { error: "Název podniku musí mít 2 až 100 znaků." };
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };

  const description = optional("description");
  if (description && description.length > 500) return { error: "Popis může mít nejvýše 500 znaků." };

  return { name, slug, description, address: optional("address"), phone: optional("phone") };
}

export async function createBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (await getOwnBusiness()) redirect("/dashboard");

  const fields = readBusinessFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .insert({ ...fields, owner_id: user.id, notification_email: user.email })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Tato adresa už je obsazená, zvolte prosím jinou." };
    return { error: "Podnik se nepodařilo uložit. Zkuste to znovu." };
  }

  // Sensible default so the booking page works right away: Mon–Fri 9:00–17:00.
  await supabase.from("opening_hours").insert(
    [1, 2, 3, 4, 5].map((weekday) => ({ business_id: business.id, weekday, opens_at: "09:00", closes_at: "17:00" })),
  );

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/services?welcome=1");
}

export async function updateBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();
  const fields = readBusinessFields(formData);
  if ("error" in fields) return fields;

  const notificationEmail = String(formData.get("notification_email") ?? "").trim();
  if (!isEmail(notificationEmail)) return { error: "Zadejte platný e-mail pro upozornění." };

  const slotStep = Number(formData.get("slot_step_minutes"));
  if (!SLOT_STEPS.includes(slotStep as (typeof SLOT_STEPS)[number])) return { error: "Neplatný krok časových slotů." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ ...fields, notification_email: notificationEmail, slot_step_minutes: slotStep })
    .eq("id", business.id);

  if (error) {
    if (error.code === "23505") return { error: "Tato adresa už je obsazená, zvolte prosím jinou." };
    return { error: "Změny se nepodařilo uložit." };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${business.slug}`);
  if (fields.slug !== business.slug) revalidatePath(`/${fields.slug}`);
  return { success: "Uloženo." };
}
