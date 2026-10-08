"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
};

export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const isLogin = mode === "login";

  if (state?.message) {
    return (
      <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900" role="status">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Heslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 8}
          required
          className="input"
        />
        {!isLogin && <p className="mt-1 text-xs text-stone-500">Alespoň 8 znaků.</p>}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton className="btn-primary w-full">{isLogin ? "Přihlásit se" : "Vytvořit účet"}</SubmitButton>

      <p className="text-center text-sm text-stone-600">
        {isLogin ? (
          <>
            Ještě nemáte účet?{" "}
            <Link href="/register" className="font-semibold text-brand-700 hover:underline">
              Zaregistrujte se
            </Link>
          </>
        ) : (
          <>
            Už máte účet?{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">
              Přihlaste se
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
