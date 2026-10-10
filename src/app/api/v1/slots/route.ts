import { runApi } from "@/lib/api/supabase-deps";

// GET /api/v1/slots?service_id=<uuid>&date=YYYY-MM-DD – free start times
export function GET(request: Request) {
  return runApi((api) => api.getSlots(request));
}
