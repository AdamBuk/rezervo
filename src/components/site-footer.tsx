export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Rezervo – portfolio projekt</p>
        <p>Next.js · Supabase · Tailwind CSS · Resend</p>
      </div>
    </footer>
  );
}
