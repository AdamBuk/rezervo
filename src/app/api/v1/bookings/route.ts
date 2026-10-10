import { runApi } from "@/lib/api/supabase-deps";

// POST /api/v1/bookings – create a booking
export function POST(request: Request) {
  return runApi((api) => api.createBooking(request));
}
