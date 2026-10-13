import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/notifications";

// Called daily by the Cloudflare Cron Trigger (wrangler.jsonc → custom-worker.ts), which sends
// "Authorization: Bearer $CRON_SECRET" automatically when CRON_SECRET is set.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDueReminders();
    console.info("[cron:reminders]", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron:reminders] failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
