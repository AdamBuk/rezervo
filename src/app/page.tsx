import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CalendarMockup, PhoneMockup } from "@/components/marketing/product-mockups";
import { PHOTOS, type Photo } from "@/lib/photos";

const stats = [
  ["24/7", "Rezervace online i mimo otevírací dobu"],
  ["0", "Dvojitých rezervací, hlídá to databáze"],
  ["60 dní", "Termíny dopředu v kalendáři"],
  ["10 min", "Od registrace k první rezervaci"],
] as const;

const businessTypes: { title: string; photo: Photo }[] = [
  { title: "Kadeřnictví", photo: PHOTOS.curls },
  { title: "Barbershop", photo: PHOTOS.barber },
  { title: "Salon krásy", photo: PHOTOS.stylist },
  { title: "Masáže", photo: PHOTOS.massage },
  { title: "Fyzioterapie", photo: PHOTOS.physio },
  { title: "Wellness a spa", photo: PHOTOS.stones },
];

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "size-6",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const features = [
  {
    title: "Online rezervace 24/7",
    text: "Vlastní stránka rezervo.cz/vas-podnik. Zákazník vybere službu, den a čas a je hotovo.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  {
    title: "Kalendář pro celý den",
    text: "Denní i týdenní přehled, tržba za období a nejbližší zákazník na první pohled.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    title: "Automatické e-maily",
    text: "Potvrzení hned po rezervaci a připomínka den předem. Méně zapomenutých termínů.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
        <path d="m4.5 7 7.5 6 7.5-6" />
      </svg>
    ),
  },
  {
    title: "Žádné dvojité rezervace",
    text: "Jakmile si někdo termín vezme, pro ostatní zmizí. Spolehlivě, přímo v databázi.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
    ),
  },
  {
    title: "Zrušení jedním klikem",
    text: "Zákazník termín zruší sám přes odkaz v e-mailu. Vy dostanete upozornění a slot je zase volný.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </svg>
    ),
  },
  {
    title: "Dovolená a svátky",
    text: "Zavřené dny zadáte předem a rezervační stránka je automaticky přeskočí.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3.5v2M12 18.5v2M5.99 5.99l1.41 1.41M16.6 16.6l1.41 1.41M3.5 12h2M18.5 12h2M5.99 18.01l1.41-1.41M16.6 7.4l1.41-1.41" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
];

const steps = [
  ["Vytvořte si účet", "Stačí e-mail a heslo. Bez platební karty."],
  ["Nastavte služby a otevírací dobu", "Názvy, délky a ceny služeb a pracovní doba po dnech."],
  ["Sdílejte odkaz", "Na Instagram, do Google profilu nebo zprávou. Rezervace začnou chodit samy."],
] as const;

const customerPerks = [
  "Rezervace za méně než minutu, i z mobilu",
  "Vidí jen skutečně volné termíny",
  "Potvrzení a připomínka e-mailem",
  "Přidání termínu do kalendáře v telefonu",
];

function CheckIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 10.5 3.2 3.2L15 7" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">
        {/* Hero */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
            <div className="stagger mx-auto max-w-4xl">
              <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-1.5 text-sm font-medium text-stone-600 shadow-(--shadow-panel)">
                <span className="size-2 rounded-full bg-sage-700" aria-hidden />
                Zdarma pro malé podniky
              </p>
              <h1 className="headline mt-6 text-[2.75rem] text-stone-900 sm:text-6xl lg:text-[4.75rem]">
                Online rezervace pro kadeřnictví, masáže a fyzio
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-600 sm:text-xl">
                Zákazníci si termín zarezervují sami, kdykoli. Vy máte všechno v jednom přehledném kalendáři a zvedáte telefon jen
                tehdy, když chcete.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary h-13 w-full px-8 text-base sm:w-auto">
                  Začít zdarma
                </Link>
                <Link href="/u-nuzek" className="btn-secondary h-13 w-full px-8 text-base sm:w-auto">
                  <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
                    <path d="M6.5 4.6v10.8a.8.8 0 0 0 1.2.7l8.6-5.4a.8.8 0 0 0 0-1.4L7.7 3.9a.8.8 0 0 0-1.2.7Z" />
                  </svg>
                  Vyzkoušet ukázku
                </Link>
              </div>
              <p className="mt-4 text-sm text-stone-500">Bez platební karty · Bez instalace · Česky</p>
            </div>
          </div>

          {/* Product screenshot on a soft brand glow */}
          <div className="relative mx-auto mt-14 max-w-6xl px-4 sm:mt-16 sm:px-6">
            <div
              aria-hidden
              className="absolute inset-x-0 top-10 bottom-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_40%,var(--color-brand-200),transparent_70%)] opacity-90 blur-2xl"
            />
            <div className="relative animate-[rise-in_800ms_var(--ease-out)_200ms_both] motion-reduce:animate-[fade-in_200ms_ease-out_both]">
              <CalendarMockup />
              <PhoneMockup className="absolute -right-2 -bottom-10 hidden rotate-3 md:block lg:-right-10" />
              {/* Floating booking notification */}
              <div
                aria-hidden
                className="absolute -bottom-6 left-6 z-10 hidden animate-[rise-in_600ms_var(--ease-out)_900ms_both] items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 shadow-(--shadow-float) motion-reduce:animate-[fade-in_200ms_ease-out_both] sm:flex lg:-left-8"
              >
                <span className="grid size-9 place-items-center rounded-full bg-sage-100 text-sage-700">
                  <CheckIcon />
                </span>
                <span className="text-sm leading-snug">
                  <span className="block font-semibold">Nová rezervace</span>
                  <span className="text-stone-500">Tereza H. · Melír · út 9:30</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Facts band */}
        <section aria-label="Rezervo v číslech" className="mt-24 bg-linear-to-br from-accent-deep via-accent to-[#b04dd9] text-white sm:mt-28">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:py-16">
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse text-center">
                <dt className="mx-auto mt-2 max-w-48 text-white/80">{label}</dt>
                <dd className="headline text-4xl tabular-nums sm:text-5xl">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Business types */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28" aria-labelledby="types-heading">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="types-heading" className="headline text-4xl sm:text-5xl">
              Pro podniky, kde se pracuje s lidmi
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              Od jednoho křesla po malý tým. Nastavíte služby, délky a ceny a Rezervo se postará o zbytek.
            </p>
            <Link href="/register" className="btn-primary mt-8 h-12 px-7">
              Začít zdarma
              <span aria-hidden>→</span>
            </Link>
          </div>
          <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {businessTypes.map(({ title, photo }) => (
              <li key={title} className="group relative aspect-square overflow-hidden rounded-2xl bg-sand-100 sm:aspect-[4/3.6]">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1024px) 24rem, 50vw"
                  className="object-cover transition-transform duration-700 ease-(--ease-out) group-hover:scale-105 motion-reduce:transition-none"
                />
                <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-black/5 to-transparent" />
                <p className="absolute bottom-4 left-4 font-display text-lg font-bold tracking-tight text-white sm:bottom-5 sm:left-5 sm:text-2xl">
                  {title}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className="bg-brand-50" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
            <div className="max-w-2xl">
              <h2 id="features-heading" className="headline text-4xl sm:text-5xl">
                Všechno, co k rezervacím potřebujete
              </h2>
              <p className="mt-4 text-lg text-stone-600">
                Žádné složité nastavování ani funkce navíc. Jen to, co malý podnik opravdu používá každý den.
              </p>
            </div>
            <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li key={f.title}>
                  <span className="grid size-12 place-items-center rounded-xl bg-surface text-brand-600 shadow-(--shadow-panel)">{f.icon}</span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-stone-600">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Customer experience */}
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:py-28" aria-labelledby="customer-heading">
          <div>
            <p className="eyebrow">Pro vaše zákazníky</p>
            <h2 id="customer-heading" className="headline mt-3 text-4xl sm:text-5xl">
              Rezervace na tři kliknutí. I o půlnoci.
            </h2>
            <p className="mt-5 text-lg text-stone-600">
              Rezervační stránka funguje skvěle na mobilu, kde vaši zákazníci tráví nejvíc času. Žádná registrace, žádná aplikace.
            </p>
            <ul className="mt-8 space-y-4">
              {customerPerks.map((perk) => (
                <li key={perk} className="flex items-center gap-3 text-lg font-medium">
                  <span className="grid size-7 place-items-center rounded-full bg-brand-100 text-brand-700">
                    <CheckIcon className="size-4" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <Link href="/u-nuzek" className="btn-primary mt-10 h-12 px-7">
              Zobrazit ukázkovou stránku
            </Link>
          </div>
          <div className="relative grid place-items-center overflow-hidden rounded-3xl bg-linear-to-br from-blush-100 via-brand-100 to-sky-100 px-6 py-14">
            <PhoneMockup className="w-64" />
            <div
              aria-hidden
              className="absolute top-10 right-6 hidden items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold shadow-(--shadow-float) sm:flex"
            >
              <span className="text-sage-700">
                <CheckIcon />
              </span>
              Potvrzeno
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="border-t border-edge" aria-labelledby="start-heading">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
            <h2 id="start-heading" className="headline max-w-xl text-4xl sm:text-5xl">
              Začněte během deseti minut
            </h2>
            <ol className="mt-14 grid gap-5 md:grid-cols-3">
              {steps.map(([title, text], i) => (
                <li key={title} className="rounded-2xl border border-edge p-7">
                  <span className="grid size-10 place-items-center rounded-full bg-ink font-display text-lg font-bold text-on-ink">{i + 1}</span>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-stone-600">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="cta-heading">
          <div className="relative overflow-hidden rounded-3xl bg-[#0d0d12] px-6 py-16 text-center text-white sm:px-12 sm:py-20 dark:bg-stone-100">
            <div aria-hidden className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent opacity-40 blur-3xl" />
            <div className="relative">
              <h2 id="cta-heading" className="headline mx-auto max-w-3xl text-4xl sm:text-6xl">
                Přestaňte řešit rezervace po telefonu
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
                Založení trvá pár minut a je zdarma. První online rezervace může přijít ještě dnes.
              </p>
              <Link
                href="/register"
                className="btn mt-9 h-13 bg-white px-8 text-base text-[#0d0d12] hover:bg-white/90 focus-visible:outline-white"
              >
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
