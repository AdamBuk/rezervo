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
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
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
          <h2 className="headline text-3xl">Vaše služby</h2>
          {services && services.length > 0 && (
            <p className="text-sm text-stone-500 tabular-nums">
              {services.filter((s) => s.is_active).length} z {services.length} na rezervační stránce
            </p>
          )}
        </div>
        {services && services.length > 0 ? (
          <ul className="panel stagger divide-y divide-edge overflow-hidden rounded-xl">
            {services.map((service) => (
              <li key={service.id}>
                <ServiceItem service={service} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
            Zatím nemáte žádné služby. Přidejte první vpravo.
          </p>
        )}
      </section>

      <aside className="card h-fit lg:sticky lg:top-20">
        <h2 className="headline mb-5 text-3xl">Nová služba</h2>
        <NewServiceForm />
      </aside>
    </div>
  );
}
