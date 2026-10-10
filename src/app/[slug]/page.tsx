import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/availability";
import { isoWeekday, todayInTimeZone } from "@/lib/time";
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

const dayMonth = new Intl.DateTimeFormat("cs-CZ", { timeZone: "UTC", day: "numeric", month: "numeric" });

/** "2026-12-24", "2026-12-26" → "24. 12. – 26. 12." (single day → "24. 12.") */
function formatClosure(startsOn: string, endsOn: string): string {
  const fmt = (d: string) => dayMonth.format(new Date(`${d}T00:00:00Z`));
  return startsOn === endsOn ? fmt(startsOn) : `${fmt(startsOn)} – ${fmt(endsOn)}`;
}

export default async function BusinessPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) notFound();

  const { business, services, hours, closures } = data;
  const today = todayInTimeZone(business.timezone);
  const todayWeekday = isoWeekday(today);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 sm:pt-8">
        <div className="glass flex animate-[rise-in_420ms_var(--ease-out)_both] flex-col gap-4 rounded-3xl p-5 motion-reduce:animate-[fade-in_200ms_ease-out_both] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-800 text-xl font-bold text-white shadow-(--shadow-brand)"
              aria-hidden
            >
              {business.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Online rezervace</p>
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{business.name}</h1>
              {business.description && (
                <p className="mt-0.5 line-clamp-2 max-w-2xl text-sm text-stone-600">{business.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm sm:shrink-0 sm:flex-col sm:items-end">
            {business.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/60 px-2.5 py-1 text-stone-600 transition-colors hover:bg-white hover:text-stone-900"
              >
                <svg viewBox="0 0 20 20" className="size-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                  <path d="M10 17.5s5.5-4.6 5.5-9a5.5 5.5 0 1 0-11 0c0 4.4 5.5 9 5.5 9Z" />
                  <circle cx="10" cy="8.5" r="2" />
                </svg>
                {business.address}
                <span className="sr-only">(mapa, nové okno)</span>
              </a>
            )}
            {business.phone && (
              <a
                href={`tel:${business.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/60 px-2.5 py-1 text-stone-600 tabular-nums transition-colors hover:bg-white hover:text-stone-900"
              >
                <svg viewBox="0 0 20 20" className="size-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                  <path d="M6.5 3.5h-2a1 1 0 0 0-1 1.1A12.5 12.5 0 0 0 15.4 16.5a1 1 0 0 0 1.1-1v-2l-3-1.2-1.5 1.5a8.5 8.5 0 0 1-4.3-4.3l1.5-1.5Z" strokeLinejoin="round" />
                </svg>
                {business.phone}
              </a>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-4 px-4 py-4 outline-none sm:px-6 sm:py-5 lg:grid-cols-[1fr_15rem]">
        <BookingWidget
          business={business}
          services={services}
          openWeekdays={hours.map((h) => h.weekday)}
          closures={closures}
          today={today}
        />

        <aside className="glass h-fit animate-[rise-in_480ms_var(--ease-out)_150ms_both] rounded-2xl p-4 text-sm motion-reduce:animate-[fade-in_200ms_ease-out_both] lg:sticky lg:top-5">
          <h2 className="font-semibold">Otevírací doba</h2>
          <dl className="mt-3 space-y-1">
            {WEEKDAYS.map((day) => {
              const h = hours.find((x) => x.weekday === day.iso);
              const isToday = day.iso === todayWeekday;
              return (
                <div
                  key={day.iso}
                  className={`-mx-2 flex justify-between gap-4 rounded-md px-2 py-0.5 ${isToday ? "bg-brand-50 font-medium text-brand-900" : ""}`}
                  aria-current={isToday ? "date" : undefined}
                >
                  <dt className={isToday ? "" : "text-stone-500"}>
                    {day.label}
                    {isToday && <span className="ml-1.5 text-xs font-semibold text-brand-700">dnes</span>}
                  </dt>
                  <dd className="tabular-nums">
                    {h ? `${trimSeconds(h.opens_at)} – ${trimSeconds(h.closes_at)}` : <span className="text-stone-400">zavřeno</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {closures.length > 0 && (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <h3 className="font-semibold">Mimořádně zavřeno</h3>
              <ul className="mt-2 space-y-1 text-stone-600">
                {closures.slice(0, 5).map((c) => (
                  <li key={`${c.starts_on}-${c.ends_on}`} className="tabular-nums">
                    {formatClosure(c.starts_on, c.ends_on)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </main>

      <footer className="py-5 text-center text-xs text-stone-400">
        Rezervace přes{" "}
        <Link href="/" className="font-semibold hover:text-stone-600">
          Rezervo
        </Link>
      </footer>
    </div>
  );
}
