import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINK =
  "rounded-full px-3 py-2 font-semibold whitespace-nowrap text-stone-700 transition-colors duration-150 hover:bg-sand-100 hover:text-stone-900 sm:px-4";

export function SiteHeader() {
  return (
    <header className="chrome sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle className="hidden md:inline-flex" />
          <nav className="flex items-center gap-1 text-[0.9375rem]" aria-label="Hlavní navigace">
            <Link href="/u-nuzek" className={`hidden sm:block ${NAV_LINK}`}>
              Ukázka
            </Link>
            <Link href="/login" className={NAV_LINK}>
              Přihlásit se
            </Link>
            <Link href="/register" className="btn-primary ml-1 whitespace-nowrap max-sm:px-4">
              Začít zdarma
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
