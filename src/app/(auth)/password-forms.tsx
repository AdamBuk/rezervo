"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { requestPasswordReset, updatePassword, type PasswordState } from "./password-actions";

function ErrorMessage({ state }: { state: PasswordState }) {
  if (!state?.error) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {state.error}
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, undefined);

  if (state?.message) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900" role="status">
          {state.message}
        </div>
        <p className="text-center text-sm">
          <Link href="/login" className="link">
            Zpět na přihlášení
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="email"
          required
          defaultValue={state?.email}
          className="input"
        />
      </div>
      <ErrorMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Odesílám…">
        Poslat odkaz
      </SubmitButton>
      <p className="text-center text-sm text-stone-600">
        Vzpomněli jste si?{" "}
        <Link href="/login" className="link">
          Přihlaste se
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(updatePassword, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {/* Lets password managers store the new password under the right account */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <label htmlFor="password" className="label">
          Nové heslo
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
        <p className="mt-1 text-xs text-stone-500">Alespoň 8 znaků.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Nové heslo znovu
        </label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
      </div>
      <ErrorMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Ukládám…">
        Uložit nové heslo
      </SubmitButton>
    </form>
  );
}
