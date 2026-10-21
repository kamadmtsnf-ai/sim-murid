import type { NextRequest } from "next/server";
import { z } from "zod";
import { educationContext, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const amount = z.coerce
      .number()
      .int()
      .min(1000)
      .max(1e12)
      .multipleOf(1000)
      .parse(request.nextUrl.searchParams.get("amount"));
    const r = await createAuthAdmin().rpc("app_fee_quote", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_amount: amount,
      p_apply: request.nextUrl.searchParams.get("apply") === "true",
    });
    if (r.error) throw new Error("Unavailable");
    if (!r.data)
      return reply({ message: "Akses atau nominal tidak valid." }, 403);
    return reply({ quote: r.data });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
