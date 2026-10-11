import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

type Feature = { title: string; text: string; icon: React.ReactNode; wide?: boolean };

const ICON = "size-5 text-brand-700";

const features: Feature[] = [
  {
    title: "Vlastní rezervační stránka",
    text: "Každý podnik dostane adresu typu rezervo.cz/vas-podnik. Odkaz pošlete zákazníkům, dáte do Google profilu nebo na Instagram.",
    wide: true,
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Žádné dvojité rezervace",
    text: "Obsazený termín si nikdo jiný nezarezervuje – hlídá to přímo databáze.",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "E-maily za vás",
    text: "Potvrzení hned po rezervaci, připomínka den předem a odkaz pro zrušení.",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="m4.5 7 7.5 6 7.5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Kalendář pro majitele",
    text: "Denní i týdenní přehled, tržby za období a nejbližší zákazník na první pohled. Termín zrušíte nebo přesunete jedním kliknutím, dovolenou zadáte předem.",
    wide: true,
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M14 13.5h2M8 16.5h2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const steps = [
  ["Zaregistrujte se", "Stačí e-mail a heslo."],
  ["Nastavte podnik", "Služby s délkou a cenou, otevírací doba po dnech."],
  ["Sdílejte odkaz", "Zákazníci si rezervují sami, i o půlnoci."],
];

const days = ["Po 13", "Út 14", "St 15", "Čt 16", "Pá 17"];
const times = ["9:00", "9:30", "10:00", "11:30", "13:00", "14:30", "15:00", "16:30"];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-14 lg:pb-12">
          <div className="stagger">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-edge/70 bg-surface/60 px-3 py-1 text-xs font-semibold text-brand-800 shadow-xs backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
              Pro kadeřnictví, fyzio a masáže
            </p>
            <h1 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-stone-900 sm:text-[3.4rem]">
              Méně telefonování,
              <br />
              <span className="bg-linear-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
                víc času na klienty.
              </span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-stone-600">
              Jednoduchý online rezervační systém pro malé podniky. Zákazníci si vyberou službu a volný termín sami, vy vše
              vidíte v přehledném kalendáři.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary px-5 py-3 text-base">
                Založit podnik zdarma
              </Link>
              <Link href="/u-nuzek" className="btn-secondary px-5 py-3 text-base">
                Prohlédnout ukázku
              </Link>
            </div>
            <p className="mt-4 text-sm text-stone-500">Bez platební karty · nastavení za 10 minut</p>
          </div>

          {/* Static preview of the public booking widget */}
          <div aria-hidden className="relative animate-[rise-in_700ms_var(--ease-out)_120ms_both] motion-reduce:animate-[fade-in_200ms_ease-out_both]">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-brand-200/60 via-brand-100/30 to-sand-200/60 blur-3xl" />
            <div className="glass space-y-4 rounded-3xl p-5 pb-12 sm:p-6 sm:pb-12">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">Kadeřnictví U Nůžek</p>
                  <p className="mt-1 font-semibold">Dámský střih</p>
                  <p className="text-sm text-stone-500">60 min · 650 Kč</p>
                </div>
                <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">Online</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center text-sm">
                {days.map((d, i) => (
                  <div
                    key={d}
                    className={`rounded-lg border px-1 py-2 ${i === 1 ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-stone-200/80 bg-surface/60 text-stone-600"}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-sm">
                {times.map((t, i) => (
                  <div
                    key={t}
                    className={`rounded-lg border py-2 text-center tabular-nums ${
                      i === 4
                        ? "border-accent-strong bg-accent-strong font-semibold text-white shadow-(--shadow-brand)"
                        : i === 2 || i === 5
                          ? "border-transparent bg-stone-100/70 text-stone-300 line-through"
                          : "border-stone-200/80 bg-surface/60 text-stone-700"
                    }`}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Overlapping notification adds depth */}
            <div className="glass-strong absolute -bottom-5 left-4 flex animate-[rise-in_600ms_var(--ease-out)_500ms_both] motion-reduce:animate-[fade-in_200ms_ease-out_both] sm:left-auto sm:-right-4 items-center gap-3 rounded-2xl border px-4 py-3 sm:-left-8">
              <span className="grid size-9 place-items-center rounded-xl bg-accent-strong text-white shadow-(--shadow-brand)">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold">Nová rezervace</span>
                <span className="text-stone-500">Jana Vávrová · út 13:00</span>
              </span>
            </div>
          </div>
        </section>

        {/* Features – bento grid */}
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8" aria-labelledby="features-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="features-heading" className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
              Všechno, co malý podnik k rezervacím potřebuje. Nic navíc.
            </h2>
            <Link href="/u-nuzek" className="text-sm font-semibold text-brand-700 hover:underline">
              Vyzkoušet jako zákazník →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className={`card group transition-[transform,box-shadow] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-(--shadow-lifted) motion-reduce:hover:translate-y-0 ${f.wide ? "sm:col-span-2" : ""}`}
              >
                <span className="grid size-10 place-items-center rounded-xl border border-edge/80 bg-brand-50/80 shadow-xs">
                  {f.icon}
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 max-w-prose text-[0.95rem] leading-relaxed text-stone-600">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works + CTA in one panel */}
        <section className="mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6" aria-labelledby="start-heading">
          <div className="glass grid gap-8 overflow-hidden rounded-3xl p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <h2 id="start-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Spuštění za 10 minut
              </h2>
              <ol className="mt-5 space-y-4">
                {steps.map(([title, text], i) => (
                  <li key={title} className="relative flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-strong text-sm font-bold text-white tabular-nums shadow-(--shadow-brand)">
                      {i + 1}
                    </span>
                    {i < steps.length - 1 && (
                      <span className="absolute top-9 left-4 h-[calc(100%-0.75rem)] w-px -translate-x-1/2 bg-brand-200" aria-hidden />
                    )}
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="text-stone-600">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-linear-to-br from-brand-50/90 to-surface/70 p-6">
              <p className="text-lg font-semibold">Připraveni přijímat rezervace online?</p>
              <p className="mt-1 text-stone-600">Registrace je zdarma a nevyžaduje platební kartu.</p>
              <Link href="/register" className="btn-primary mt-5 w-full py-3 text-base sm:w-auto sm:px-6">
                Začít zdarma
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
