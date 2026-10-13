import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD, DEMO_SLUG } from "@/lib/demo";

// Called hourly by the Cloudflare Cron Trigger (custom-worker.ts). Undoes account-level
// changes to the shared demo account that bypassed the app (e.g. direct Supabase calls):
// password, page address, notification e-mail and the seeded API key.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      userId = data.users.find((u) => u.email?.toLowerCase() === DEMO_OWNER_EMAIL)?.id ?? null;
      if (data.users.length < 100) break;
    }
    if (!userId) return NextResponse.json({ reset: false, reason: "demo_user_missing" });

    const { error: userError } = await supabase.auth.admin.updateUserById(userId, {
      email: DEMO_OWNER_EMAIL,
      password: DEMO_OWNER_PASSWORD,
    });
    if (userError) throw userError;

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .update({ slug: DEMO_SLUG, notification_email: DEMO_OWNER_EMAIL })
      .eq("owner_id", userId)
      .select("id")
      .maybeSingle();
    if (bizError) throw bizError;

    let apiKeyRestored = false;
    if (business) {
      // The oldest key is the one issued by the seed script (documented for demo users).
      const { data: keys, error: keysError } = await supabase
        .from("api_keys")
        .select("id, revoked_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true });
      if (keysError) throw keysError;

      const [seeded, ...others] = keys ?? [];
      const strayActive = others.filter((k) => k.revoked_at === null).map((k) => k.id);
      if (strayActive.length) {
        const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).in("id", strayActive);
        if (error) throw error;
      }
      if (seeded && seeded.revoked_at !== null) {
        const { error } = await supabase.from("api_keys").update({ revoked_at: null }).eq("id", seeded.id);
        if (error) throw error;
        apiKeyRestored = true;
      }
    }

    const result = { reset: true, business: Boolean(business), apiKeyRestored };
    console.info("[cron:demo-reset]", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron:demo-reset] failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
