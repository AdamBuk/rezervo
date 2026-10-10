import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ResetPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Nové heslo", robots: { index: false } };

export default async function ResetPasswordPage() {
  // Reached through the e-mail link: /auth/callback has already signed the user in.
  const user = await requireUser();

  return (
    <>
      <h1 className="text-xl font-bold">Nastavte si nové heslo</h1>
      <p className="mb-6 mt-1 text-sm text-stone-600">
        Pro účet <strong className="break-all text-stone-900">{user.email}</strong>.
      </p>
      <ResetPasswordForm email={user.email} />
    </>
  );
}
