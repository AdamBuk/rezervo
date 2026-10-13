import Link from "next/link";

/** App mark (calendar with a booked slot) + wordmark. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg font-display text-[1.375rem] font-bold tracking-[-0.04em] text-stone-900">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-ink" />
        <rect x="8" y="9" width="16" height="15" rx="3" fill="none" className="stroke-on-ink" strokeWidth="2.2" />
        <path d="M8 14h16M12 6.5v4M20 6.5v4" className="stroke-on-ink" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="19.5" cy="19" r="2" className="fill-brand-400" />
      </svg>
      rezervo
    </Link>
  );
}
