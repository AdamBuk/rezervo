import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-stone-500 sm:block">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="btn-secondary px-3 py-1.5">
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
