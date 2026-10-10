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
      <section className="card" aria-labelledby="api-key-heading">
        <h2 id="api-key-heading" className="text-lg font-semibold">
          API klíč
        </h2>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          Klíč umožní externí aplikaci (např. AI asistentovi) číst vaše služby a volné termíny a vytvářet či rušit
          rezervace. Uchovávejte ho v tajnosti – kdo ho má, může spravovat rezervace vašeho podniku.
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
          Jak API použít
        </h2>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          Klíč posílejte v hlavičce <code className="rounded bg-stone-100 px-1">Authorization: Bearer &lt;klíč&gt;</code>.
          Kompletní dokumentace endpointů je v README projektu.
        </p>
        <dl className="mb-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="font-medium text-stone-700">Základní URL</dt>
          <dd className="break-all font-mono text-stone-600">{baseUrl}</dd>
        </dl>
        <ul className="mb-4 grid gap-1 font-mono text-xs text-stone-600">
          <li>GET  /services</li>
          <li>GET  /slots?service_id=…&amp;date=RRRR-MM-DD</li>
          <li>POST /bookings</li>
          <li>POST /bookings/{"{id}"}/cancel</li>
        </ul>
        <pre className="overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs leading-relaxed text-stone-100">
          <code>{`curl ${baseUrl}/services \\\n  -H "Authorization: Bearer rzv_live_…"`}</code>
        </pre>
      </section>
    </div>
  );
}
