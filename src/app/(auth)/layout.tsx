import Image from "next/image";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PHOTOS } from "@/lib/photos";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <main id="main" tabIndex={-1} className="flex flex-col px-4 py-6 outline-none sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <div className="card p-7 sm:p-9">{children}</div>
        </div>
      </main>

      {/* Photo side (desktop only) */}
      <aside className="relative hidden p-4 lg:block" aria-hidden>
        <div className="relative h-full overflow-hidden rounded-[2.5rem]">
          <Image src={PHOTOS.curls.src} alt="" fill sizes="50vw" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <p className="headline max-w-md text-4xl">Rezervace přijdou, i když máte zrovna plné ruce práce.</p>
            <p className="mt-3 text-lg text-white/80">Online rezervace pro kadeřnictví, masáže a fyzioterapii.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
