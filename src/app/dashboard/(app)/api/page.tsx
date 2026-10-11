import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { ApiKeyManager } from "./api-key-manager";

export const metadata: Metadata = { title: "API" };

export default async function ApiPage() {
  const business = await requireBusiness();
  const supabase = await createClient();

  const { data: activeKey } = await supabase
    .from("api_keys")
    .select("id, key_prefix, created_at, last_used_at")
    .eq("business_id", business.id)
    .is("revoked_at", null)
    .maybeSingle();

  const baseUrl = `${await getSiteUrl()}/api/v1`;

  return (
    <div className="stagger grid items-start gap-4 lg:grid-cols-2">
      <section className="card lg:col-span-2" aria-labelledby="api-intro-heading">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Pro pokročilé</p>
            <h2 id="api-intro-heading" className="mt-1 text-lg font-semibold">
              K čemu je API klíč
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              API umožní jiné aplikaci rezervovat termíny u vašeho podniku stejně, jako to dělají zákazníci na
              rezervační stránce. Klíč je heslo, kterým se ta aplikace prokáže.
            </p>
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
              <span className="font-semibold">Nic nepropojujete?</span> Pak klíč nepotřebujete a tuhle stránku můžete
              ignorovat. Rezervace přes web fungují i bez něj.
            </p>
          </div>
          <ul className="grid shrink-0 gap-2 text-sm md:w-72">
            {USE_CASES.map((item) => (
              <li key={item.title} className="rounded-xl border border-edge/80 bg-surface/50 px-3.5 py-2.5">
                <p className="font-medium text-stone-900">{item.title}</p>
                <p className="text-stone-500">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card" aria-labelledby="api-key-heading">
        <h2 id="api-key-heading" className="text-lg font-semibold">
          API klíč
        </h2>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          Uchovávejte ho v tajnosti – kdo ho má, může vytvářet a rušit rezervace vašeho podniku. Při úniku vygenerujte
          nový, starý tím přestane fungovat.
        </p>
        <ApiKeyManager
          activeKey={
            activeKey
              ? {
                  prefix: activeKey.key_prefix,
                  createdAt: activeKey.created_at,
                  lastUsedAt: activeKey.last_used_at,
                  timeZone: business.timezone,
                }
              : null
          }
        />
      </section>

      <section className="card" aria-labelledby="api-usage-heading">
        <h2 id="api-usage-heading" className="text-lg font-semibold">
          Pro vývojáře
        </h2>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          Klíč posílejte v hlavičce{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-stone-700">Authorization: Bearer &lt;klíč&gt;</code>.
          Kompletní dokumentace endpointů je v README projektu.
        </p>
        <dl className="mb-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="font-medium text-stone-700">Základní URL</dt>
          <dd className="font-mono break-all text-stone-600">{baseUrl}</dd>
        </dl>
        <ul className="mb-4 divide-y divide-stone-200/70 overflow-hidden rounded-xl border border-edge/80 bg-surface/50 font-mono text-xs">
          {ENDPOINTS.map(([method, path]) => (
            <li key={`${method} ${path}`} className="flex items-center gap-3 px-3 py-2">
              <span
                className={`w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold ${
                  method === "GET" ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-900"
                }`}
              >
                {method}
              </span>
              <span className="break-all text-stone-700">{path}</span>
            </li>
          ))}
        </ul>
        <pre className="overflow-x-auto rounded-xl bg-[#0f1716] p-4 text-xs leading-relaxed text-[#d8e2e0] ring-1 ring-edge/60 dark:bg-black/35">
          <code>{`curl ${baseUrl}/services \\\n  -H "Authorization: Bearer rzv_live_…"`}</code>
        </pre>
      </section>
    </div>
  );
}

const USE_CASES = [
  { title: "AI asistent", text: "Chatbot na webu nebo telefonu, který za zákazníka najde a zarezervuje termín." },
  { title: "Vlastní web nebo aplikace", text: "Rezervační formulář přímo ve vašem stávajícím webu." },
  { title: "Napojení na jiné systémy", text: "Například pokladna nebo CRM, které potřebují vidět rezervace." },
] as const;

const ENDPOINTS = [
  ["GET", "/services"],
  ["GET", "/slots?service_id=…&date=RRRR-MM-DD"],
  ["POST", "/bookings"],
  ["GET", "/bookings/{id}"],
  ["POST", "/bookings/{id}/cancel"],
] as const;
