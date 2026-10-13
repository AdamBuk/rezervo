import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ResetPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Nové heslo", robots: { index: false } };

export default async function ResetPasswordPage() {
  // Reached through the e-mail link: /auth/callback has already signed the user in.
  const user = await requireUser();

  return (
    <>
      <h1 className="headline text-3xl sm:text-4xl">Nastavte si nové heslo</h1>
      <p className="mt-3 mb-7 text-stone-600">
        Pro účet <strong className="break-all text-stone-900">{user.email}</strong>.
      </p>
      <ResetPasswordForm email={user.email} />
    </>
  );
}
