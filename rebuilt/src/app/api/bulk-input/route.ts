import { bulkTemplate } from "@/lib/spreadsheets/templates";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  bulkInput,
  bulkResult,
  bulkCatalog,
  bulkDomains,
} from "@/lib/bulk/validation";
import { parseBulkRows } from "@/lib/bulk/rows";
import {readExcel,decodeWorkbook} from "@/lib/spreadsheets/read";
import {headers} from "@/lib/bulk/validation";
import type { Json } from "@/lib/supabase/cloud.types";
function parseResult(value: unknown) {
  const result = bulkResult.safeParse(value);
  if (!result.success) throw Error("Unconfirmed backend result");
  return result.data;
}
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    if (request.nextUrl.search)
      return reply({ message: "Parameter tidak valid." }, 400);
    const input = bulkInput.parse(await jsonBody(request, 1500000));
    let parsed;
    try {
      parsed = parseBulkRows(await readExcel(decodeWorkbook(input.workbook),headers[input.domain],["username","teacher_username"],bulkTemplate(input.domain)), input.domain);
    } catch {
      return reply(
        {
          message:
            "Excel tidak valid. Gunakan template .xlsx terbaru maksimal 1 MiB dan 100 baris.",
        },
        400,
      );
    }
    if (parsed.issues.length)
      return reply(
        {
          message: "Batch ditolak; tidak ada data disimpan.",
          issues: parsed.issues,
        },
        422,
      );
    const r = await createAuthAdmin()
      .rpc("app_bulk_input", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
        p_request: input.requestId,
        p_action: input.action,
        p_domain: input.domain,
        ...(input.revision !== undefined ? { p_revision: input.revision } : {}),
        p_options: input.options as Json,
        p_rows: parsed.rows as Json,
      })
      .abortSignal(AbortSignal.timeout(30000));
    if (r.error) throw Error("Unavailable");
    const result = parseResult(r.data);
    if (
      (result.code === "ready" || result.code === "saved") &&
      (result.requestId !== input.requestId ||
        result.rows?.length !== parsed.count)
    )
      throw Error("Unconfirmed");
    return reply(
      { result },
      result.code === "denied"
        ? 403
        : ["ready", "saved"].includes(result.code)
          ? 200
          : 409,
    );
  } catch (e) {
    const err = failure(e);
    return reply(
      {
        message:
          err.status === 503
            ? "Hasil impor belum dapat dipastikan. Periksa hasil dengan ID permintaan yang sama."
            : err.message,
      },
      err.status,
    );
  }
}
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    if (request.nextUrl.searchParams.get("catalog") === "1") {
      const q = z
        .object({
          catalog: z.literal("1"),
          domain: bulkDomains,
          classId: z.uuid(),
          subjectId: z.uuid().optional(),
        })
        .strict()
        .parse(Object.fromEntries(request.nextUrl.searchParams));
      const r = await createAuthAdmin()
        .rpc("app_bulk_catalog", {
          p_actor: caller.principal.id,
          p_session: caller.sessionId,
          p_domain: q.domain,
          p_class: q.classId,
          ...(q.subjectId ? { p_subject: q.subjectId } : {}),
        })
        .abortSignal(AbortSignal.timeout(15000));
      if (r.error) throw Error("Unavailable");
      if (!r.data) return reply({ message: "Referensi tidak diizinkan." }, 403);
      const parsedCatalog = bulkCatalog.safeParse(r.data);
      if (!parsedCatalog.success) throw Error("Unavailable catalog");
      const catalog = parsedCatalog.data;
      if (catalog.classId !== q.classId || catalog.domain !== q.domain)
        throw Error("Scope mismatch");
      return reply({ catalog });
    }
    const q = z
      .object({ requestId: z.uuid() })
      .strict()
      .parse(Object.fromEntries(request.nextUrl.searchParams));
    const r = await createAuthAdmin()
      .rpc("app_bulk_input", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
        p_request: q.requestId,
        p_action: "status",
      })
      .abortSignal(AbortSignal.timeout(30000));
    if (r.error) throw Error("Unavailable");
    const result = parseResult(r.data);
    if (result.code === "saved" && result.requestId !== q.requestId)
      throw Error("Unconfirmed");
    return reply({ result }, result.code === "denied" ? 403 : 200);
  } catch (e) {
    const err = failure(e);
    return reply({ message: err.message }, err.status);
  }
}
