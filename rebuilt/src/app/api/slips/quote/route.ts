import { savingsAmount, parseFeeQuote } from "@/lib/operations/savings";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { educationContext, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const amount = savingsAmount.parse(
        Number(request.nextUrl.searchParams.get("amount")),
      ),
      apply =
        z
          .enum(["true", "false"])
          .parse(request.nextUrl.searchParams.get("apply") ?? "false") ===
        "true";
    const r = await createAuthAdmin().rpc("app_fee_quote", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_amount: amount,
      p_apply: apply,
    });
    if (r.error) throw new Error("Unavailable");
    if (!r.data)
      return reply({ message: "Akses atau nominal tidak valid." }, 403);
    let quote;
    try {
      quote = parseFeeQuote(r.data, amount, apply);
    } catch {
      throw Error("Quote unavailable");
    }
    return reply({ quote });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
