import type { Metadata } from "next";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Zapomenuté heslo" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Zapomenuté heslo</h1>
      <p className="mb-6 mt-1 text-sm text-stone-600">Pošleme vám e-mailem odkaz, přes který si nastavíte nové heslo.</p>
      <ForgotPasswordForm />
    </>
  );
}
