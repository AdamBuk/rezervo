import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey, KeyEncryptionError } from "./key-crypto";
import { generateApiKey } from "./keys";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("API key encryption", () => {
  it("round-trips a key with a fresh IV each time", () => {
    const { key } = generateApiKey();
    const a = encryptApiKey(key, SECRET);
    const b = encryptApiKey(key, SECRET);
    expect(a).not.toBe(b);
    expect(a).not.toContain(key);
    expect(a.length).toBeLessThan(500);
    expect(decryptApiKey(a, SECRET)).toBe(key);
    expect(decryptApiKey(b, SECRET)).toBe(key);
  });

  it("fails with a different secret or tampered value", () => {
    const payload = encryptApiKey(generateApiKey().key, SECRET);
    expect(() => decryptApiKey(payload, `${SECRET}-other`)).toThrow(KeyEncryptionError);
    const [v, iv, tag, ct] = payload.split(".");
    const tampered = [v, iv, tag, (ct[0] === "A" ? "B" : "A") + ct.slice(1)].join(".");
    expect(() => decryptApiKey(tampered, SECRET)).toThrow(KeyEncryptionError);
    expect(() => decryptApiKey("garbage", SECRET)).toThrow(KeyEncryptionError);
  });

  it("requires a long enough secret", () => {
    expect(() => encryptApiKey("x", undefined)).toThrow(KeyEncryptionError);
    expect(() => encryptApiKey("x", "short")).toThrow(KeyEncryptionError);
  });
});
