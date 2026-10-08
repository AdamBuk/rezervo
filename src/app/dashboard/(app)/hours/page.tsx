import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HoursForm } from "./hours-form";

export const metadata: Metadata = { title: "Otevírací doba" };

export default async function HoursPage() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: hours } = await supabase.from("opening_hours").select("*").eq("business_id", business.id);

  return (
    <div className="card max-w-2xl">
      <h2 className="text-lg font-semibold">Otevírací doba</h2>
      <p className="mb-4 mt-1 text-sm text-stone-600">
        Zákazníkům nabídneme jen termíny, které se celé vejdou do otevírací doby.
      </p>
      <HoursForm hours={hours ?? []} />
    </div>
  );
}
