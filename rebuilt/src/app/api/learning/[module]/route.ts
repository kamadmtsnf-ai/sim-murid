import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { learningModules, commands, messages } from "@/lib/learning/validation";
import { learningData } from "@/lib/learning/server";
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
    const domain = learningModules.parse((await params).module),
      query = Object.fromEntries(request.nextUrl.searchParams),
      format = query.format,
      selected = query.selected,
      kind = query.kind;
    delete query.format;
    delete query.selected;
    delete query.kind;
    const data = await learningData(
      caller.principal.id,
      caller.sessionId,
      domain,
      query,
    );
    if (format === "pdf" && domain === "reports") {
      const { reportsPdf } = await import("@/lib/learning/print");
      const ids = selected
        ? z.array(z.uuid()).min(1).max(500).parse(selected.split(","))
        : null;
      const rows = ids
        ? data.rows.filter((r) => ids.includes(String(r.student_id)))
        : data.rows;
      if (ids && rows.length !== new Set(ids).size)
        return reply({ message: "Pilihan rapor tidak diizinkan." }, 403);
      const reportKind = z
        .enum(["combined", "PH", "ATS", "ASAS", "Praktik"])
        .default("combined")
        .parse(kind);
      const bytes = await reportsPdf(rows, reportKind);
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="rapor.pdf"',
          "Cache-Control": "no-store",
        },
      });
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
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const domain = learningModules.parse((await params).module),
      body = mutationEnvelope.parse(await jsonBody(request)),
      command = commands[domain].parse(body.command);
    const r = await createAuthAdmin().rpc("app_learning_write", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_request: body.requestId,
      p_revision: body.revision,
      p_module: domain,
      p_command: command as Json,
    });
    if (r.error) throw new Error("Unavailable");
    const result = z.object({ code: z.string() }).passthrough().parse(r.data);
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
