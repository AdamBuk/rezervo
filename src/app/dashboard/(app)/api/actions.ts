"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness, requireUser } from "@/lib/auth";
import { DEMO_LOCKED_MESSAGE, isDemoOwner } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api/keys";
import { decryptApiKey, encryptApiKey, KeyEncryptionError } from "@/lib/api/key-crypto";

export type ApiKeyState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "revoked" }
  /** Plaintext key, returned right after generation or when the owner asks to see it. */
  | { status: "created" | "revealed"; key: string };

const MISSING_SECRET_ERROR =
  "Na serveru chybí nastavení API_KEY_ENCRYPTION_SECRET, bez něj nelze klíč bezpečně uložit. Doplňte ho do proměnných prostředí.";

async function createApiKey(): Promise<ApiKeyState> {
  await requireBusiness();
  const { key, hash, prefix } = generateApiKey();

  let ciphertext: string;
  try {
    ciphertext = encryptApiKey(key, process.env.API_KEY_ENCRYPTION_SECRET);
  } catch (err) {
    console.error("[api-keys] encryption failed", err);
    return { status: "error", error: MISSING_SECRET_ERROR };
  }

  // Revokes the previous key and stores the new one in one transaction.
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_api_key", {
    p_key_hash: hash,
    p_key_prefix: prefix,
    p_key_ciphertext: ciphertext,
  });
  if (error) {
    console.error("[api-keys] rotate failed", error);
    return { status: "error", error: "Klíč se nepodařilo vygenerovat. Zkuste to prosím znovu." };
  }

  revalidatePath("/dashboard/api");
  return { status: "created", key };
}

async function revealApiKey(): Promise<ApiKeyState> {
  const business = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("key_ciphertext")
    .eq("business_id", business.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[api-keys] load failed", error);
    return { status: "error", error: "Klíč se nepodařilo načíst. Zkuste to prosím znovu." };
  }
  if (!data) return { status: "error", error: "Nemáte žádný aktivní klíč." };

  try {
    return { status: "revealed", key: decryptApiKey(data.key_ciphertext, process.env.API_KEY_ENCRYPTION_SECRET) };
  } catch (err) {
    console.error("[api-keys] decryption failed", err);
    const missing = !(err instanceof KeyEncryptionError) || (process.env.API_KEY_ENCRYPTION_SECRET ?? "").length < 32;
    return {
      status: "error",
      error: missing
        ? MISSING_SECRET_ERROR
        : "Klíč nelze zobrazit (na serveru se změnil API_KEY_ENCRYPTION_SECRET). Klíč stále funguje; pro zobrazení vygenerujte nový.",
    };
  }
}

async function revokeApiKey(): Promise<ApiKeyState> {
  const business = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error("[api-keys] revoke failed", error);
    return { status: "error", error: "Klíč se nepodařilo zneplatnit. Zkuste to prosím znovu." };
  }
  if (!data.length) return { status: "error", error: "Žádný aktivní klíč k zneplatnění." };

  revalidatePath("/dashboard/api");
  return { status: "revoked" };
}

/** Single action for the key manager, so the UI always reflects the latest operation. */
export async function manageApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const intent = formData.get("intent");
  if ((intent === "create" || intent === "revoke") && isDemoOwner((await requireUser()).email)) {
    return { status: "error", error: DEMO_LOCKED_MESSAGE };
  }
  if (intent === "create") return createApiKey();
  if (intent === "reveal") return revealApiKey();
  if (intent === "revoke") return revokeApiKey();
  return { status: "error", error: "Neznámá akce." };
}
