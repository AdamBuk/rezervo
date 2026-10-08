import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/availability";
import { todayInTimeZone } from "@/lib/time";
import { trimSeconds } from "@/lib/format";
import { WEEKDAYS } from "@/lib/constants";
import { BookingWidget } from "./booking-widget";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) return { title: "Podnik nenalezen" };
  return {
    title: `${data.business.name} – online rezervace`,
    description: data.business.description ?? `Rezervujte si termín v ${data.business.name} online.`,
  };
}

export default async function BusinessPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) notFound();

  const { business, services, hours } = data;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-sm font-medium text-brand-700">Online rezervace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{business.name}</h1>
          {business.description && <p className="mt-2 max-w-2xl text-stone-600">{business.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-500">
            {business.address && <span>{business.address}</span>}
            {business.phone && (
              <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="hover:text-stone-800">
                {business.phone}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_16rem]">
        <BookingWidget
          business={business}
          services={services}
          openWeekdays={hours.map((h) => h.weekday)}
          today={todayInTimeZone(business.timezone)}
        />

        <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5 text-sm lg:sticky lg:top-6">
          <h2 className="font-semibold">Otevírací doba</h2>
          <dl className="mt-3 space-y-1.5">
            {WEEKDAYS.map((day) => {
              const h = hours.find((x) => x.weekday === day.iso);
              return (
                <div key={day.iso} className="flex justify-between gap-4">
                  <dt className="text-stone-500">{day.label}</dt>
                  <dd className="tabular-nums">
                    {h ? `${trimSeconds(h.opens_at)} – ${trimSeconds(h.closes_at)}` : <span className="text-stone-400">zavřeno</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </aside>
      </main>

      <footer className="py-6 text-center text-xs text-stone-400">
        Rezervace přes{" "}
        <Link href="/" className="font-semibold hover:text-stone-600">
          Rezervo
        </Link>
      </footer>
    </div>
  );
}
