import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { DashboardNav } from "./dashboard-nav";

export default async function AppLayout({ children }: LayoutProps<"/dashboard">) {
  const business = await requireBusiness();

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-14 outline-none sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-100 font-display text-2xl font-bold text-brand-700"
            aria-hidden
          >
            {business.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-500">Váš podnik</p>
            <h1 className="headline truncate text-3xl sm:text-4xl">{business.name}</h1>
          </div>
        </div>
        <Link href={`/${business.slug}`} target="_blank" rel="noopener" className="btn-secondary">
          Rezervační stránka
          <span aria-hidden>↗</span>
          <span className="sr-only">/{business.slug} (otevře se v novém okně)</span>
        </Link>
      </div>
      <DashboardNav />
      <div className="mt-6">{children}</div>
    </main>
  );
}
