import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <header className="mx-auto w-full max-w-5xl px-4 pt-4 pb-8 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-100 via-brand-50 to-blush-100 px-6 pt-8 pb-7 sm:px-10 sm:pt-12 sm:pb-10">
          <div className="stagger">
            <span
              aria-hidden
              className="grid size-16 place-items-center rounded-2xl bg-ink font-display text-3xl font-bold text-on-ink"
            >
              {business.name.trim().charAt(0).toUpperCase()}
            </span>
            <h1 className="headline mt-5 text-4xl sm:text-5xl">{business.name}</h1>
            {business.description && (
              <p className="mt-3 line-clamp-3 max-w-2xl text-lg leading-relaxed text-stone-700">{business.description}</p>
            )}
            {(business.address || business.phone) && (
              <div className="mt-6 flex flex-wrap gap-2">
                {business.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-semibold text-stone-800 shadow-(--shadow-panel) transition-colors hover:bg-surface"
                  >
                    <svg viewBox="0 0 20 20" className="size-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
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
                    className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-semibold text-stone-800 tabular-nums shadow-(--shadow-panel) transition-colors hover:bg-surface"
                  >
                    <svg viewBox="0 0 20 20" className="size-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                      <path d="M6.5 3.5h-2a1 1 0 0 0-1 1.1A12.5 12.5 0 0 0 15.4 16.5a1 1 0 0 0 1.1-1v-2l-3-1.2-1.5 1.5a8.5 8.5 0 0 1-4.3-4.3l1.5-1.5Z" strokeLinejoin="round" />
                    </svg>
                    {business.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 px-4 pb-12 outline-none sm:px-6 lg:grid-cols-[1fr_17rem] lg:gap-8">
        <BookingWidget
          business={business}
          services={services}
          openWeekdays={hours.map((h) => h.weekday)}
          closures={closures}
          today={today}
        />

        <aside className="card h-fit animate-[rise-in_480ms_var(--ease-out)_150ms_both] motion-reduce:animate-[fade-in_200ms_ease-out_both] lg:sticky lg:top-6">
          <h2 className="font-display text-lg font-bold tracking-tight">Otevírací doba</h2>
          <dl className="mt-3 space-y-1">
            {WEEKDAYS.map((day) => {
              const h = hours.find((x) => x.weekday === day.iso);
              const isToday = day.iso === todayWeekday;
              return (
                <div
                  key={day.iso}
                  className={`-mx-3 flex justify-between gap-4 rounded-xl px-3 py-1.5 ${isToday ? "bg-brand-50 font-semibold text-brand-800" : ""}`}
                  aria-current={isToday ? "date" : undefined}
                >
                  <dt className={isToday ? "" : "text-stone-600"}>
                    {day.label}
                    {isToday && <span className="ml-1.5 text-sm font-semibold text-brand-600">dnes</span>}
                  </dt>
                  <dd className="tabular-nums">
                    {h ? `${trimSeconds(h.opens_at)} – ${trimSeconds(h.closes_at)}` : <span className="text-stone-400">zavřeno</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {closures.length > 0 && (
            <div className="mt-5 border-t border-edge pt-4">
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

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-6 text-sm text-stone-500 sm:px-6">
        <p>
          Rezervace přes{" "}
          <Link href="/" className="font-semibold text-brand-700 hover:underline">
            Rezervo
          </Link>
        </p>
        <ThemeToggle />
      </footer>
    </div>
  );
}
