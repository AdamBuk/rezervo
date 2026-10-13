import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { login } from "../actions";

export const metadata: Metadata = { title: "Přihlášení" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="headline text-3xl sm:text-4xl">Přihlášení</h1>
      <p className="mt-3 mb-7 text-stone-600">Vítejte zpět. Přihlaste se ke správě rezervací.</p>
      {error === "link" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
          Odkaz z e-mailu je neplatný nebo vypršel. Zkuste se přihlásit, případně se zaregistrujte znovu.
        </p>
      )}
      {error === "reset" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
          Odkaz pro obnovu hesla je neplatný nebo vypršel. Požádejte prosím o nový.
        </p>
      )}
      <AuthForm mode="login" action={login} next={typeof next === "string" ? next : undefined} />
    </>
  );
}
