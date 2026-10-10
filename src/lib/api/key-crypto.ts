import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Reversible storage of API keys, so owners can look their key up in the
// dashboard. Format: "v1.<iv>.<auth tag>.<ciphertext>" (base64url, AES-256-GCM).

const VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

export class KeyEncryptionError extends Error {}

function deriveKey(secret: string | undefined): Buffer {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new KeyEncryptionError(`API_KEY_ENCRYPTION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptApiKey(plaintext: string, secret: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** Throws KeyEncryptionError when the value is malformed or the secret doesn't match. */
export function decryptApiKey(payload: string, secret: string | undefined): string {
  const key = deriveKey(secret);
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new KeyEncryptionError("Unsupported ciphertext format");
  try {
    const [, iv, tag, ciphertext] = parts;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new KeyEncryptionError("API key could not be decrypted (wrong secret or corrupted value)");
  }
}
