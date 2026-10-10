import { createHash, randomBytes } from "node:crypto";

// Keys look like "rzv_live_<43 base64url chars>" (256 bits of entropy). Because
// they're random rather than user-chosen, a fast SHA-256 hash is enough to store
// them safely – there's nothing to brute-force from the hash.

export const API_KEY_PREFIX = "rzv_live_";
const KEY_BYTES = 32;
const KEY_PATTERN = /^rzv_live_[A-Za-z0-9_-]{43}$/;
/** Characters of the key shown in the dashboard to recognise it. */
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 4;

export type GeneratedApiKey = {
  /** Plaintext key – shown to the owner once, never stored. */
  key: string;
  hash: string;
  prefix: string;
};

export function generateApiKey(): GeneratedApiKey {
  const key = API_KEY_PREFIX + randomBytes(KEY_BYTES).toString("base64url");
  return { key, hash: hashApiKey(key), prefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function isWellFormedApiKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

export type BearerResult = { ok: true; key: string } | { ok: false; reason: "missing" | "malformed" };

/** Extracts the key from an `Authorization: Bearer <key>` header. */
export function parseBearer(header: string | null): BearerResult {
  if (header === null || header.trim() === "") return { ok: false, reason: "missing" };
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header.trim());
  if (!match) return { ok: false, reason: "malformed" };
  return { ok: true, key: match[1] };
}
