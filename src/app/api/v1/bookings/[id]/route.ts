import { runApi } from "@/lib/api/supabase-deps";

// GET /api/v1/bookings/{id} – booking detail (status, time, customer)
export async function GET(request: Request, ctx: RouteContext<"/api/v1/bookings/[id]">) {
  const { id } = await ctx.params;
  return runApi((api) => api.getBooking(request, id));
}
