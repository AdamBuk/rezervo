import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="glass-strong sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-stone-500 md:block">{user.email}</span>
            <ThemeToggle />
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
