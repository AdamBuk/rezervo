"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, type ActionState } from "@/lib/constants";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveOpeningHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const business = await requireBusiness();

  const rows: { business_id: string; weekday: number; opens_at: string; closes_at: string }[] = [];
  for (const day of WEEKDAYS) {
    if (formData.get(`open_${day.iso}`) !== "on") continue;

    const opensAt = String(formData.get(`opens_${day.iso}`) ?? "");
    const closesAt = String(formData.get(`closes_${day.iso}`) ?? "");
    if (!TIME.test(opensAt) || !TIME.test(closesAt)) return { error: `${day.label}: zadejte platný čas.` };
    if (closesAt <= opensAt) return { error: `${day.label}: zavírací čas musí být po otevíracím.` };

    rows.push({ business_id: business.id, weekday: day.iso, opens_at: opensAt, closes_at: closesAt });
  }

  const supabase = await createClient();
  const closedDays = WEEKDAYS.map((d) => d.iso).filter((iso) => !rows.some((r) => r.weekday === iso));

  if (closedDays.length) {
    const { error } = await supabase
      .from("opening_hours")
      .delete()
      .eq("business_id", business.id)
      .in("weekday", closedDays);
    if (error) return { error: "Otevírací dobu se nepodařilo uložit." };
  }
  if (rows.length) {
    const { error } = await supabase.from("opening_hours").upsert(rows, { onConflict: "business_id,weekday" });
    if (error) return { error: "Otevírací dobu se nepodařilo uložit." };
  }

  revalidatePath("/dashboard/hours");
  revalidatePath(`/${business.slug}`);
  return { success: "Otevírací doba uložena." };
}
