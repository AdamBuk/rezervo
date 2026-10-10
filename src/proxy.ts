import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only routes that depend on the owner's session; public booking pages skip the proxy.
  matcher: ["/dashboard/:path*", "/login", "/register", "/reset-password"],
};
