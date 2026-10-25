import type { NextRequest } from "next/server";
import { educationContext, failure } from "@/lib/education/server";
import { auditHistory } from "@/lib/audit/server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    return reply({
      data: await auditHistory(
        caller.principal.id,
        caller.sessionId,
        Object.fromEntries(request.nextUrl.searchParams),
      ),
    });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
