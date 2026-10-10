import { runApi } from "@/lib/api/supabase-deps";

// POST /api/v1/bookings/{id}/cancel – cancel a booking
export async function POST(request: Request, ctx: RouteContext<"/api/v1/bookings/[id]/cancel">) {
  const { id } = await ctx.params;
  return runApi((api) => api.cancelBooking(request, id));
}
