// OpenNext bundles every value from .env* files into the worker (.open-next/cloudflare/next-env.mjs).
// Keep only public NEXT_PUBLIC_* values there; server secrets come from `wrangler secret put`.
import { writeFile } from "node:fs/promises";

const file = new URL("../.open-next/cloudflare/next-env.mjs", import.meta.url);
const env = await import(file.href);

const lines = Object.entries(env).map(([mode, vars]) => {
  const publicVars = Object.fromEntries(Object.entries(vars).filter(([key]) => key.startsWith("NEXT_PUBLIC_")));
  return `export const ${mode} = ${JSON.stringify(publicVars)};\n`;
});
await writeFile(file, lines.join(""));

const removed = Object.keys(env.production ?? {}).filter((key) => !key.startsWith("NEXT_PUBLIC_"));
console.log(`[cf-strip-env] kept NEXT_PUBLIC_* only, removed: ${removed.join(", ") || "nothing"}`);
