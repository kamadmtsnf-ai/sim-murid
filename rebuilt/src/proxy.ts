import { NextResponse, type NextRequest } from "next/server";
import { requestAuth, verifiedPrincipal } from "@/lib/auth/http";

import { loadAccessContext } from "@/lib/auth/authorization";
import { canAccessAccountPage } from "@/lib/auth/page-policy";

/** Every account navigation, including RSC requests, is admitted before rendering. */
export async function proxy(request: NextRequest) {
  request.headers.set("x-sim-path",request.nextUrl.pathname);
  const response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  let blocked: NextResponse | undefined;
  try {
    const client = requestAuth(request, response);
    const caller = await verifiedPrincipal(client);
    if (!caller) {
      blocked = NextResponse.redirect(new URL("/login?expired=1", request.url));
    } else if (!canAccessAccountPage(request.nextUrl.pathname, [], false)) {
      const access = await loadAccessContext(client, AbortSignal.timeout(5000));
      if (!access || access.user_id !== caller.principal.id) {
        blocked = new NextResponse("Hak akses belum dapat diverifikasi. Silakan coba kembali.", { status: 503 });
      } else if (!canAccessAccountPage(request.nextUrl.pathname, access.grants.map(g => g.capability), caller.principal.is_admin)) {
        blocked = new NextResponse("Akses halaman ini tidak diizinkan untuk akun Anda.", { status: 403 });
      }
    }
  } catch {
    blocked = new NextResponse("Layanan keamanan belum tersedia. Silakan coba kembali.", { status: 503 });
  }
  // Forward the refreshed request cookies to the Server Component as well.
  const next = blocked ?? NextResponse.next({ request: { headers: request.headers } });
  response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
  response.headers.forEach((value, key) => {
    if (["cache-control", "pragma", "expires"].includes(key)) next.headers.set(key, value);
  });
  next.headers.set("Cache-Control", "private, no-store");
  next.headers.set("Vary", "Cookie");
  next.headers.set("X-Content-Type-Options", "nosniff");
  return next;
}
export const config = { matcher: ["/account/:path*"] };
