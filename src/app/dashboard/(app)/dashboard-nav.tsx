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

/** Segmented glass navigation; scrolls sideways on narrow screens. */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administrace" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="glass inline-flex min-w-max gap-1 rounded-xl p-1">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3.5 py-1.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-200 ease-(--ease-out) ${
                  active
                    ? "bg-white text-brand-800 shadow-(--shadow-glass)"
                    : "text-stone-600 hover:bg-white/60 hover:text-stone-900"
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
