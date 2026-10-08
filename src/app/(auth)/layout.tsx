import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="card w-full max-w-sm">{children}</div>
    </main>
  );
}
