import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-edge/60 bg-surface/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Rezervo – portfolio projekt</p>
        <nav aria-label="Patička" className="flex flex-wrap items-center gap-4">
          <Link href="/u-nuzek" className="hover:text-stone-800">
            Ukázka
          </Link>
          <Link href="/login" className="hover:text-stone-800">
            Přihlášení
          </Link>
          <span translate="no">Next.js · Supabase</span>
          <ThemeToggle />
        </nav>
      </div>
    </footer>
  );
}
