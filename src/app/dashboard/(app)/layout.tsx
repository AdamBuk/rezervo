import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { DashboardNav } from "./dashboard-nav";

export default async function AppLayout({ children }: LayoutProps<"/dashboard">) {
  const business = await requireBusiness();

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Váš podnik</p>
          <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        </div>
        <Link
          href={`/${business.slug}`}
          target="_blank"
          rel="noopener"
          className="rounded-md text-sm font-medium text-brand-700 hover:underline"
        >
          Rezervační stránka <span translate="no">/{business.slug}</span> <span aria-hidden>↗</span>
          <span className="sr-only">(otevře se v novém okně)</span>
        </Link>
      </div>
      <DashboardNav />
      <div className="mt-6">{children}</div>
    </main>
  );
}
