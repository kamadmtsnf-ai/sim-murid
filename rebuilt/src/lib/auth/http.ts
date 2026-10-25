import { logResponseFailure } from "@/lib/observability/log";
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { createAuthAdmin } from "@/lib/auth/admin";
import { principalSchema, verifiedTokenSession } from "@/lib/auth/validation";

export function privateJson(body: unknown, status = 200) {
  const reference = crypto.randomUUID();
  logResponseFailure(reference, status);
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Request-ID": reference,
    },
  });
}

export function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function requestAuth(request: NextRequest, response: NextResponse) {
  const { url, publishableKey } = getSupabasePublicEnvironment();
  return createServerClient(url, publishableKey, {
    cookieOptions: {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        cookies.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
}

export async function verifiedPrincipal(
  client: ReturnType<typeof requestAuth>,
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && (!error.status || error.status >= 500))
    throw new Error("Auth verification unavailable");
  if (error || !user) return null;
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session || session.user.id !== user.id) return null;
  const sessionId = verifiedTokenSession(session.access_token, user.id);
  const { data, error: registryError } = await createAuthAdmin().rpc(
    "app_auth_principal",
    { p_user: user.id, p_session: sessionId },
  );
  if (registryError) throw new Error("Session registry unavailable");
  const parsed = principalSchema.safeParse(data);
  return parsed.success ? { principal: parsed.data, sessionId } : null;
}
