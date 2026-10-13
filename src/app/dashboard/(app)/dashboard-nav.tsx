"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Kalendář" },
  { href: "/dashboard/services", label: "Služby" },
  { href: "/dashboard/hours", label: "Otevírací doba" },
  { href: "/dashboard/settings", label: "Nastavení" },
  { href: "/dashboard/api", label: "API" },
] as const;

/** Pill navigation; scrolls sideways on narrow screens. */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administrace" className="-mx-4 mt-7 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="inline-flex min-w-max gap-1 rounded-full bg-sand-100 p-1">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-4 py-2 text-[0.9375rem] font-semibold transition-[color,background-color] duration-200 ease-(--ease-out) ${
                  active ? "bg-surface text-stone-900 shadow-(--shadow-panel)" : "text-stone-600 hover:text-stone-900"
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
