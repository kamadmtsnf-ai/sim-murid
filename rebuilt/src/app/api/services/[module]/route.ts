import type { NextRequest } from "next/server";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { modules, commands, messages } from "@/lib/services/validation";
import { servicesData } from "@/lib/services/server";
import { mutationEnvelope } from "@/lib/operations/validation";
import type { Json } from "@/lib/supabase/cloud.types";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const domain = modules.parse((await params).module),
      query = Object.fromEntries(request.nextUrl.searchParams),
      format = query.format;
    delete query.format;
    const data = await servicesData(
      caller.principal.id,
      caller.sessionId,
      domain,
      query,
    );
    if (format) {
      const { exportServices } = await import("@/lib/services/export");
      return exportServices(data, format);
    }
    return reply({ data });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  if (!sameOrigin(request))
    return privateJson({ message: "Origin ditolak." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const domain = modules
        .exclude(["reconciliation"])
        .parse((await params).module),
      body = mutationEnvelope.parse(await jsonBody(request)),
      command = commands[domain].parse(body.command),
      r = await createAuthAdmin().rpc("app_services_write", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
        p_request: body.requestId,
        p_revision: body.revision,
        p_module: domain,
        p_command: command as Json,
      });
    if (r.error) throw new Error("Unavailable");
    const result = r.data as { code: string };
    return reply(
      {
        result,
        message: messages[result.code] ?? "Permintaan belum berhasil.",
      },
      result.code === "saved" ? 200 : result.code === "denied" ? 403 : 409,
    );
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
