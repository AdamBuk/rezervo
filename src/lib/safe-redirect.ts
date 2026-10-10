const BASE = "http://local.invalid";

/**
 * Returns `value` only when it's a same-origin path, otherwise `fallback`.
 * Parsing with URL catches tricks a prefix check misses: browsers treat
 * "/\evil.com" like "//evil.com", and tabs/newlines are stripped from URLs.
 */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
