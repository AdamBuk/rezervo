import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { register } from "../actions";

export const metadata: Metadata = { title: "Registrace" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Registrace podniku</h1>
      <p className="mb-6 mt-1 text-sm text-stone-600">Založte si účet a za pár minut přijímejte rezervace online.</p>
      <AuthForm mode="register" action={register} />
    </>
  );
}
