import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { DashboardNav } from "./dashboard-nav";

export default async function AppLayout({ children }: LayoutProps<"/dashboard">) {
  const business = await requireBusiness();

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 outline-none sm:px-6 sm:py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-accent-deep font-bold text-white shadow-(--shadow-brand)"
            aria-hidden
          >
            {business.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-500">Váš podnik</p>
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{business.name}</h1>
          </div>
        </div>
        <Link
          href={`/${business.slug}`}
          target="_blank"
          rel="noopener"
          className="btn-secondary px-3 py-1.5 text-brand-700"
        >
          Rezervační stránka <span translate="no">/{business.slug}</span> <span aria-hidden>↗</span>
          <span className="sr-only">(otevře se v novém okně)</span>
        </Link>
      </div>
      <DashboardNav />
      <div className="mt-4">{children}</div>
    </main>
  );
}
