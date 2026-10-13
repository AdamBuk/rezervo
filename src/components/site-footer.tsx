import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-edge bg-sand-100/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 text-stone-600">Online rezervace pro kadeřnictví, masáže a fyzioterapii.</p>
        </div>
        <nav aria-label="Patička" className="flex flex-wrap items-center gap-x-6 gap-y-3 font-semibold text-stone-700">
          <Link href="/u-nuzek" className="transition-colors hover:text-brand-700">
            Ukázka
          </Link>
          <Link href="/login" className="transition-colors hover:text-brand-700">
            Přihlášení
          </Link>
          <ThemeToggle />
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-sm text-stone-500 sm:px-6">
        © {new Date().getFullYear()} Rezervo · portfolio projekt · Fotografie: Unsplash
      </p>
    </footer>
  );
}
