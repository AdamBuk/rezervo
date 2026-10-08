import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight text-stone-900">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm text-white"
      >
        R
      </span>
      <span className="text-lg">Rezervo</span>
    </Link>
  );
}
