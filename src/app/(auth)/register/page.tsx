import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { register } from "../actions";

export const metadata: Metadata = { title: "Registrace" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="headline text-3xl sm:text-4xl">Registrace podniku</h1>
      <p className="mt-3 mb-7 text-stone-600">Založte si účet a za pár minut přijímejte rezervace online.</p>
      <AuthForm mode="register" action={register} />
    </>
  );
}
