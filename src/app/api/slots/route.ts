import { NextResponse, type NextRequest } from "next/server";
import { getAvailability } from "@/lib/availability";

// GET /api/slots?slug=u-nuzek&service=<uuid>&date=2026-10-14
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = params.get("slug") ?? "";
  const serviceId = params.get("service") ?? "";
  const date = params.get("date") ?? "";

  try {
    const availability = await getAvailability(slug, serviceId, date);
    if (!availability) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(availability, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[slots] failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
