"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Kalendář" },
  { href: "/dashboard/services", label: "Služby" },
  { href: "/dashboard/hours", label: "Otevírací doba" },
  { href: "/dashboard/settings", label: "Nastavení" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-stone-200">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-brand-700 text-brand-800"
                    : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
