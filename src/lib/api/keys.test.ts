import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, generateApiKey, hashApiKey, isWellFormedApiKey, parseBearer } from "./keys";

describe("generateApiKey", () => {
  it("creates a well-formed, unique key with matching hash and prefix", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(isWellFormedApiKey(a.key)).toBe(true);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.key.startsWith(a.prefix)).toBe(true);
    expect(a.prefix.length).toBeLessThan(a.key.length);
  });
});

describe("isWellFormedApiKey", () => {
  it("rejects other formats", () => {
    expect(isWellFormedApiKey("")).toBe(false);
    expect(isWellFormedApiKey("rzv_live_short")).toBe(false);
    expect(isWellFormedApiKey(`rzv_test_${"a".repeat(43)}`)).toBe(false);
    expect(isWellFormedApiKey(`rzv_live_${"a".repeat(42)}!`)).toBe(false);
  });
});

describe("parseBearer", () => {
  it("extracts the token", () => {
    expect(parseBearer("Bearer abc")).toEqual({ ok: true, key: "abc" });
    expect(parseBearer("bearer   abc  ")).toEqual({ ok: true, key: "abc" });
  });

  it("reports missing and malformed headers", () => {
    expect(parseBearer(null)).toEqual({ ok: false, reason: "missing" });
    expect(parseBearer("  ")).toEqual({ ok: false, reason: "missing" });
    expect(parseBearer("Basic abc")).toEqual({ ok: false, reason: "malformed" });
    expect(parseBearer("Bearer")).toEqual({ ok: false, reason: "malformed" });
    expect(parseBearer("Bearer a b")).toEqual({ ok: false, reason: "malformed" });
  });
});
