import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Data access layer: the verified current user, or a redirect to /login. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");

  return {
    id: data.claims.sub,
    email: (data.claims.email as string | undefined) ?? "",
  };
});

/** The owner's business, or null when onboarding hasn't been completed yet. */
export const getOwnBusiness = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle();
  return data;
});

/** Like getOwnBusiness, but sends owners without a business to onboarding. */
export async function requireBusiness() {
  const business = await getOwnBusiness();
  if (!business) redirect("/dashboard/setup");
  return business;
}
