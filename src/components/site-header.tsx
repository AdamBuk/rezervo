import Link from "next/link";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-sand-50/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm sm:gap-2" aria-label="Hlavní navigace">
          <Link
            href="/u-nuzek"
            className="hidden rounded-md px-3 py-2 font-medium whitespace-nowrap text-stone-600 transition-colors hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-brand-600 sm:block"
          >
            Ukázka
          </Link>
          <Link
            href="/login"
            className="rounded-md px-2.5 py-2 font-medium whitespace-nowrap text-stone-600 transition-colors hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-brand-600 sm:px-3"
          >
            Přihlásit se
          </Link>
          <Link href="/register" className="btn-primary whitespace-nowrap">
            <span className="sm:hidden">Začít zdarma</span>
            <span className="hidden sm:inline">Vyzkoušet zdarma</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
