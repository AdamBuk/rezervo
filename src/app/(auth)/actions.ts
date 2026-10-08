"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export type AuthState = { error?: string; message?: string; email?: string } | undefined;

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  // Only allow local paths to prevent open redirects.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Vyplňte e-mail i heslo.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "E-mail ještě není potvrzený. Klikněte na odkaz, který jsme vám poslali.", email };
    }
    return { error: "Nesprávný e-mail nebo heslo.", email };
  }

  redirect(safeNext(formData.get("next")));
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Zadejte platný e-mail.", email };
  if (password.length < 8) return { error: "Heslo musí mít alespoň 8 znaků.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await getSiteUrl()}/auth/callback?next=/dashboard/setup` },
  });

  if (error) {
    if (error.code === "user_already_exists") return { error: "Účet s tímto e-mailem už existuje.", email };
    if (error.code === "weak_password") return { error: "Heslo je příliš slabé, zvolte silnější.", email };
    return { error: "Registrace se nezdařila. Zkuste to prosím znovu.", email };
  }

  // E-mail confirmation disabled in Supabase → we already have a session.
  if (data.session) redirect("/dashboard/setup");

  return { message: `Poslali jsme vám e-mail na ${email}. Registraci dokončíte kliknutím na odkaz v něm.` };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
