import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewStaffForm, StaffItem } from "./staff-forms";

export const metadata: Metadata = { title: "Tým" };

export default async function StaffPage() {
  const business = await requireBusiness();
  const supabase = await createClient();

  const [{ data: staff }, { data: services }, { data: upcoming }] = await Promise.all([
    supabase
      .from("staff")
      .select("*, staff_services(service_id)")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("services")
      .select("id, name, is_active")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("bookings")
      .select("staff_id")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gte("starts_at", new Date().toISOString()),
  ]);

  const members = staff ?? [];
  const serviceOptions = services ?? [];
  const activeCount = members.filter((m) => m.is_active).length;
  const bookingCount = (staffId: string) => (upcoming ?? []).filter((b) => b.staff_id === staffId).length;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="headline text-3xl">Tým</h2>
          <p className="text-sm text-stone-500 tabular-nums">
            {activeCount} {activeCount === 1 ? "aktivní pracovník" : activeCount <= 4 ? "aktivní pracovníci" : "aktivních pracovníků"}
          </p>
        </div>
        <p className="text-sm text-stone-600">
          Každý pracovník má vlastní kalendář – ve stejný čas lze rezervovat tolik zákazníků, kolik je volných pracovníků.
          {activeCount > 1
            ? " Zákazníci si na rezervační stránce vyberou konkrétního pracovníka, nebo „Kdokoli“."
            : " Dokud je v týmu jen jeden pracovník, rezervační stránka výběr pracovníka nezobrazuje."}
        </p>
        <ul className="panel stagger divide-y divide-edge overflow-hidden rounded-xl">
          {members.map((member) => (
            <li key={member.id}>
              <StaffItem
                member={member}
                services={serviceOptions}
                serviceIds={member.staff_services.map((l) => l.service_id)}
                bookingCount={bookingCount(member.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      <aside className="card h-fit lg:sticky lg:top-20">
        <h2 className="headline mb-5 text-3xl">Nový pracovník</h2>
        <NewStaffForm services={serviceOptions} />
      </aside>
    </div>
  );
}
