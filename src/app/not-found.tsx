import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="outline-none mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-bold">Stránka nenalezena</h1>
      <p className="mt-2 text-stone-600">Tahle stránka neexistuje, nebo byla přesunuta.</p>
      <Link href="/" className="btn-primary mt-6">
        Zpět na úvod
      </Link>
    </main>
  );
}
