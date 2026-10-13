import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { BusinessForm } from "../../business-form";
import { updateBusiness } from "../../business-actions";

export const metadata: Metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const business = await requireBusiness();

  return (
    <div className="card max-w-2xl">
      <h2 className="headline mb-6 text-3xl">Údaje o podniku</h2>
      <BusinessForm action={updateBusiness} business={business} siteHost={new URL(await getSiteUrl()).host} submitLabel="Uložit změny" />
    </div>
  );
}
