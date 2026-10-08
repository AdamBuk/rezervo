import { NextResponse, type NextRequest } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

// GET /api/slots?slug=u-nuzek&service=<uuid>&date=2026-10-14
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = params.get("slug") ?? "";
  const serviceId = params.get("service") ?? "";
  const date = params.get("date") ?? "";

  const slots = await getAvailableSlots(slug, serviceId, date);
  if (!slots) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
