import Link from "next/link";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="border-b border-stone-200/70 bg-sand-50/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/u-nuzek" className="hidden px-3 py-2 font-medium text-stone-600 hover:text-stone-900 sm:block">
            Ukázka
          </Link>
          <Link href="/login" className="px-3 py-2 font-medium text-stone-600 hover:text-stone-900">
            Přihlásit se
          </Link>
          <Link href="/register" className="btn-primary">
            Vyzkoušet zdarma
          </Link>
        </nav>
      </div>
    </header>
  );
}
