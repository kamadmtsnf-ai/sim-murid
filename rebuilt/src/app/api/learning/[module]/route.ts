import {
  mappingError,
  promotionsSnapshot,
  promotionConfirmed,
} from "@/lib/learning/promotions";
import { reportFilters } from "@/lib/learning/reports";
import { gradeFilters } from "@/lib/learning/grades";
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
        ? z
            .array(z.uuid())
            .min(1)
            .max(500)
            .refine((v) => new Set(v).size === v.length)
            .parse(selected.split(","))
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
      if (!rows.length)
        return reply({ message: "Tidak ada rapor sesuai filter." }, 404);
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
      body = mutationEnvelope.parse(
        await jsonBody(request, domain === "promotions" ? 131072 : 65536),
      ),
      command = commands[domain].parse(body.command),
      filters =
        domain === "grades"
          ? gradeFilters.parse(Object.fromEntries(request.nextUrl.searchParams))
          : domain === "reports"
            ? reportFilters.parse(
                Object.fromEntries(request.nextUrl.searchParams),
              )
            : undefined;
    if (domain === "reports") {
      const publish = commands.reports.parse(command);
      if (filters) {
        filters.classId ??= publish.classId;
        filters.semester ??= publish.semester;
      }
      if (
        filters?.classId !== publish.classId ||
        Number(filters?.semester) !== publish.semester
      )
        return reply(
          {
            message: "Filter rapor berubah. Muat ulang sebelum menerbitkan.",
            code: "stale",
          },
          409,
        );
    }
    if (domain === "promotions") {
      const current = promotionsSnapshot.parse(
        await learningData(caller.principal.id, caller.sessionId, domain),
      );
      if (!current.isAdmin)
        return reply(
          { message: "Akses tidak diizinkan.", code: "denied" },
          403,
        );
      // Stale requests still reach the RPC: it resolves an existing request UUID
      // before its revision check, preserving legitimate idempotent replays.
      if (current.revision === body.revision) {
        const issue = mappingError(current, commands.promotions.parse(command));
        if (issue) return reply({ message: issue, code: "invalid" }, 409);
      }
    }
    const r = await createAuthAdmin().rpc("app_learning_write", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_request: body.requestId,
      p_revision: body.revision,
      p_module: domain,
      p_command: command as Json,
    });
    if (r.error) throw new Error("Unavailable");
    if (
      ["grades", "reports", "promotions"].includes(domain) &&
      !z
        .object({
          code: z.enum([
            "saved",
            "denied",
            "invalid",
            "stale",
            "request_conflict",
            "not_found",
            "duplicate",
            "published",
            "incomplete",
          ]),
        })
        .safeParse(r.data).success
    )
      throw Error("Uncertain grade acknowledgement");
    const result = z.object({ code: z.string() }).passthrough().parse(r.data);
    const data =
      ["grades", "reports", "promotions"].includes(domain) &&
      result.code === "saved"
        ? await learningData(
            caller.principal.id,
            caller.sessionId,
            domain,
            filters,
          )
        : undefined;
    if (
      domain === "promotions" &&
      result.code === "saved" &&
      (!data ||
        data.revision <= body.revision ||
        !promotionConfirmed(
          promotionsSnapshot.parse(data),
          commands.promotions.parse(command),
        ))
    )
      throw Error("Promotion readback not confirmed");
    if (domain === "reports" && result.code === "saved") {
      const publish = commands.reports.parse(command);
      if (
        !data ||
        data.revision <= body.revision ||
        !publish.studentIds.every((id) =>
          data.rows.some((row) => row.student_id === id && row.published),
        )
      )
        throw Error("Report publication not confirmed");
    }
    return reply(
      {
        result,
        ...(["grades", "reports", "promotions"].includes(domain)
          ? { code: result.code, ...(data ? { data } : {}) }
          : {}),
        message: messages[result.code] ?? "Permintaan belum berhasil.",
      },
      result.code === "saved" ? 200 : result.code === "denied" ? 403 : 409,
    );
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
