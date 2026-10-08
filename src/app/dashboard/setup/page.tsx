import { redirect } from "next/navigation";
import { getOwnBusiness } from "@/lib/auth";

export default async function SetupPage() {
  if (await getOwnBusiness()) redirect("/dashboard");
  return <div className="card m-6">Nastavení podniku bude brzy k dispozici.</div>;
}
