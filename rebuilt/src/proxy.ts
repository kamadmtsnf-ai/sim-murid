import { NextResponse, type NextRequest } from "next/server";
import { requestAuth } from "@/lib/auth/http";

/** Refresh only; authorization always happens again in the protected server flow. */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  try { await requestAuth(request, response).auth.getUser(); } catch { /* Page fails closed. */ }
  // Forward the refreshed request cookies to the Server Component as well.
  const next = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
  next.headers.set("Cache-Control", "private, no-store");
  return next;
}
export const config = { matcher: ["/account/:path*"] };
