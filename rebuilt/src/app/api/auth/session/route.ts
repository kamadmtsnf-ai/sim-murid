import type { NextRequest } from "next/server";
import { privateJson, requestAuth, verifiedPrincipal } from "@/lib/auth/http";

export async function GET(request: NextRequest) {
  const response = privateJson({});
  try {
    const state = await verifiedPrincipal(requestAuth(request, response));
    const result = privateJson(state ? { user: state.principal } : { message: "Sesi berakhir. Silakan masuk kembali." }, state ? 200 : 401);
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  } catch {
    return privateJson({ message: "Pemeriksaan sesi sedang tidak tersedia." }, 503);
  }
}
