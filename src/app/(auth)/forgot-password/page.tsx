import type { Metadata } from "next";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Zapomenuté heslo" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="headline text-3xl sm:text-4xl">Zapomenuté heslo</h1>
      <p className="mt-3 mb-7 text-stone-600">Pošleme vám e-mailem odkaz, přes který si nastavíte nové heslo.</p>
      <ForgotPasswordForm />
    </>
  );
}
