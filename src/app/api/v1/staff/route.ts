import { runApi } from "@/lib/api/supabase-deps";

// GET /api/v1/staff – active staff of the API key's business with the services they perform
export function GET(request: Request) {
  return runApi((api) => api.listStaff(request));
}
