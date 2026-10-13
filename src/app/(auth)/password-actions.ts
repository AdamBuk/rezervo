"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { isEmail } from "@/lib/format";
import { isRateLimitedByIp } from "@/lib/rate-limit";
import { DEMO_LOCKED_MESSAGE, isDemoOwner } from "@/lib/demo";

export type PasswordState = { error?: string; message?: string; email?: string } | undefined;

const RESET_LIMIT = { limit: 5, windowSeconds: 900 } as const;

export async function requestPasswordReset(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "Zadejte platný e-mail.", email };

  // The shared demo account has no real inbox; never send it reset e-mails.
  if (isDemoOwner(email)) return { error: DEMO_LOCKED_MESSAGE, email };

  if (await isRateLimitedByIp("password-reset", RESET_LIMIT.limit, RESET_LIMIT.windowSeconds)) {
    return { error: "Příliš mnoho žádostí. Zkuste to prosím za pár minut.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getSiteUrl()}/auth/callback?next=/reset-password`,
  });
  // Unknown e-mails get the same answer, so the form can't be used to find out who has an account.
  if (error && error.status !== 400 && error.status !== 404) {
    console.error("[password-reset] failed", error);
    if (error.status === 429) return { error: "Příliš mnoho žádostí. Zkuste to prosím za chvíli.", email };
    return { error: "Žádost se nepodařilo odeslat. Zkuste to prosím znovu.", email };
  }

  return {
    message: `Pokud k e-mailu ${email} existuje účet, poslali jsme na něj odkaz pro nastavení nového hesla. Platí 1 hodinu.`,
  };
}

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Heslo musí mít alespoň 8 znaků." };
  if (password !== confirm) return { error: "Hesla se neshodují." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?error=reset");
  if (isDemoOwner(data.claims.email as string | undefined)) return { error: DEMO_LOCKED_MESSAGE };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Nové heslo musí být jiné než původní." };
    if (error.code === "weak_password") return { error: "Heslo je příliš slabé, zvolte silnější." };
    console.error("[password-update] failed", error);
    return { error: "Heslo se nepodařilo změnit. Zkuste to prosím znovu." };
  }

  redirect("/dashboard?password=changed");
}
