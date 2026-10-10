import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const features = [
  {
    title: "Vlastní rezervační stránka",
    text: "Každý podnik dostane adresu typu rezervo.cz/vas-podnik. Odkaz pošlete zákazníkům nebo ho dáte na Instagram.",
  },
  {
    title: "Žádné dvojité rezervace",
    text: "Volné sloty se počítají z otevírací doby a délky služby. Obsazený termín si nikdo jiný nezarezervuje – hlídá to přímo databáze.",
  },
  {
    title: "E-maily za vás",
    text: "Zákazník i vy dostanete potvrzení hned po rezervaci a zákazníkovi den předem přijde připomínka.",
  },
  {
    title: "Kalendář pro majitele",
    text: "Denní i týdenní přehled rezervací. Termín zrušíte nebo přesunete na jiný čas jedním kliknutím.",
  },
];

const steps = [
  ["Zaregistrujte se", "Stačí e-mail a heslo."],
  ["Nastavte podnik", "Služby s délkou a cenou, otevírací doba po dnech."],
  ["Sdílejte odkaz", "Zákazníci si rezervují sami, i o půlnoci."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              Pro kadeřnictví, fyzio a masáže
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
              Méně telefonování,
              <br />
              <span className="text-brand-700">víc času na klienty.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
              Rezervo je jednoduchý online rezervační systém pro malé podniky. Zákazníci si vyberou službu a volný
              termín sami, vy vše vidíte v přehledném kalendáři.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-5 py-3 text-base">
                Založit podnik zdarma
              </Link>
              <Link href="/u-nuzek" className="btn-secondary px-5 py-3 text-base">
                Prohlédnout ukázku
              </Link>
            </div>
          </div>

          {/* Static preview of the public booking widget */}
          <div aria-hidden className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-brand-100/60 blur-2xl" />
            <div className="card space-y-5 p-6 shadow-lg">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Kadeřnictví U Nůžek</p>
                <p className="mt-1 font-semibold">Dámský střih</p>
                <p className="text-sm text-stone-500">60 min · 650 Kč</p>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                {["Po 13", "Út 14", "St 15", "Čt 16", "Pá 17"].map((d, i) => (
                  <div
                    key={d}
                    className={`rounded-lg border px-1 py-2 ${i === 1 ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-stone-200 text-stone-600"}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                {["9:00", "9:30", "10:00", "11:30", "13:00", "14:30", "15:00", "16:30"].map((t, i) => (
                  <div
                    key={t}
                    className={`rounded-lg border py-2 text-center ${
                      i === 4
                        ? "border-brand-700 bg-brand-700 font-semibold text-white"
                        : i === 2 || i === 5
                          ? "border-stone-100 bg-stone-50 text-stone-300 line-through"
                          : "border-stone-200 text-stone-700"
                    }`}
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
                Úterý 14. 10. v 13:00 – potvrzení odešleme e-mailem.
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="max-w-lg text-2xl font-bold tracking-tight sm:text-3xl">
              Všechno, co malý podnik k rezervacím potřebuje. Nic navíc.
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="border-l-2 border-brand-500 pl-5">
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-stone-600">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Spuštění za 10 minut</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map(([title, text], i) => (
              <li key={title} className="card">
                <span className="text-sm font-bold text-brand-600">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1 text-stone-600">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 rounded-2xl bg-brand-900 px-6 py-10 text-center text-white sm:px-12">
            <h2 className="text-2xl font-bold">Připraveni přijímat rezervace online?</h2>
            <p className="mt-2 text-brand-100">Registrace je zdarma a nevyžaduje platební kartu.</p>
            <Link href="/register" className="btn mt-6 bg-white px-5 py-3 text-base text-brand-900 hover:bg-brand-50">
              Začít
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
