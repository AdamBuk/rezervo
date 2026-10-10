import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/time";
import { HoursForm } from "./hours-form";
import { ClosuresManager } from "./closures-manager";

export const metadata: Metadata = { title: "Otevírací doba" };

export default async function HoursPage() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const today = todayInTimeZone(business.timezone);
  const [{ data: hours }, { data: closures }] = await Promise.all([
    supabase.from("opening_hours").select("*").eq("business_id", business.id),
    supabase
      .from("closures")
      .select("id, starts_on, ends_on, note")
      .eq("business_id", business.id)
      .gte("ends_on", today)
      .order("starts_on"),
  ]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="card" aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-lg font-semibold">
          Otevírací doba
        </h2>
        <p className="mb-4 mt-1 text-sm text-stone-600">
          Zákazníkům nabídneme jen termíny, které se celé vejdou do otevírací doby.
        </p>
        <HoursForm hours={hours ?? []} />
      </section>

      <section className="card" aria-labelledby="closures-heading">
        <h2 id="closures-heading" className="text-lg font-semibold">
          Dovolená a zavírací dny
        </h2>
        <p className="mb-4 mt-1 text-sm text-stone-600">
          Svátky, dovolená nebo nemoc. V tyto dny si zákazníci nic nezarezervují – ani přes web, ani přes API.
        </p>
        <ClosuresManager closures={closures ?? []} today={today} />
      </section>
    </div>
  );
}
