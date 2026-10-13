import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOwnBusiness } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { BusinessForm } from "../business-form";
import { createBusiness } from "../business-actions";

export const metadata: Metadata = { title: "Nastavení podniku" };

export default async function SetupPage() {
  if (await getOwnBusiness()) redirect("/dashboard");

  return (
    <main id="main" tabIndex={-1} className="outline-none mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <p className="eyebrow">Krok 1 ze 3</p>
      <h1 className="headline mt-3 text-5xl">Představte svůj podnik</h1>
      <p className="mt-2 text-stone-600">
        Tyto údaje uvidí zákazníci na vaší rezervační stránce. Vše můžete později změnit v nastavení.
      </p>
      <div className="card mt-8">
        <BusinessForm action={createBusiness} siteHost={new URL(await getSiteUrl()).host} submitLabel="Pokračovat ke službám" />
      </div>
    </main>
  );
}
