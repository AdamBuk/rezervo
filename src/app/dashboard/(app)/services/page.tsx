import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewServiceForm, ServiceItem } from "./service-forms";

export const metadata: Metadata = { title: "Služby" };

export default async function ServicesPage({ searchParams }: PageProps<"/dashboard/services">) {
  const business = await requireBusiness();
  const { welcome } = await searchParams;

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("sort_order")
    .order("created_at");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-3">
        {welcome && (
          <div className="rounded-2xl border border-brand-200/80 bg-brand-50/80 p-4 text-sm text-brand-900 backdrop-blur">
            <p className="font-semibold">Krok 2 ze 3: Přidejte služby, které nabízíte.</p>
            <p className="mt-1">
              Otevírací dobu jsme předvyplnili na Po–Pá 9:00–17:00.{" "}
              <Link href="/dashboard/hours" className="font-semibold underline">
                Upravit otevírací dobu →
              </Link>
            </p>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Vaše služby</h2>
          {services && services.length > 0 && (
            <p className="text-sm text-stone-500 tabular-nums">
              {services.filter((s) => s.is_active).length} z {services.length} na rezervační stránce
            </p>
          )}
        </div>
        {services && services.length > 0 ? (
          <ul className="glass stagger divide-y divide-stone-200/60 overflow-hidden rounded-2xl">
            {services.map((service) => (
              <li key={service.id}>
                <ServiceItem service={service} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="glass rounded-2xl border-dashed p-6 text-center text-stone-500">
            Zatím nemáte žádné služby. Přidejte první vpravo.
          </p>
        )}
      </section>

      <aside className="card h-fit lg:sticky lg:top-20">
        <h2 className="mb-4 text-lg font-semibold">Nová služba</h2>
        <NewServiceForm />
      </aside>
    </div>
  );
}
