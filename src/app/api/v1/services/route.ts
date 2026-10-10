import { runApi } from "@/lib/api/supabase-deps";

// GET /api/v1/services – active services of the API key's business
export function GET(request: Request) {
  return runApi((api) => api.listServices(request));
}
