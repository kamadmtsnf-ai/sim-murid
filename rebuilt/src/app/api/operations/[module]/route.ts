import {
  mentoringFilters,
  mentoringMessages,
} from "@/lib/operations/mentoring";
import {
  attendanceFilters,
  attendanceMonth,
  attendanceMessages,
} from "@/lib/operations/attendance";
import { dutyFilters, dutyMessages } from "@/lib/operations/duty";
import type { NextRequest } from "next/server";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { operationsData, operationMessages } from "@/lib/operations/server";
import {
  mutationEnvelope,
  operationModules,
  parseCommand,
} from "@/lib/operations/validation";
import type { Json } from "@/lib/supabase/cloud.types";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const domain = operationModules.parse((await params).module),
      query = Object.fromEntries(request.nextUrl.searchParams),
      format = query.format;
    delete query.format;
    const calendar = query.calendar;
    delete query.calendar;
    if (
      calendar &&
      (domain !== "attendance" ||
        format ||
        !z.uuid().safeParse(query.studentId).success ||
        Object.keys(query).some((k) => k !== "studentId"))
    )
      z.never().parse(calendar);
    const filters =
      domain === "duty"
        ? {
            ...dutyFilters.parse(query),
            ...(format ? { export: true, page: 1 } : {}),
          }
        : domain === "attendance"
          ? attendanceFilters.parse(
              calendar
                ? {
                    ...attendanceMonth(calendar),
                    studentId: query.studentId,
                    export: true,
                    page: 1,
                  }
                : { ...query, ...(format ? { export: true, page: 1 } : {}) },
            )
          : domain === "mentoring"
            ? mentoringFilters.parse({
                ...query,
                ...(format ? { export: true, page: 1 } : {}),
              })
            : { ...query, ...(format ? { export: true, page: 1 } : {}) };
    const data = await operationsData(
      caller.principal.id,
      caller.sessionId,
      domain,
      filters,
    );
    if (format) {
      const output = z.enum(["xlsx", "pdf"]).parse(format),
        { operationsExport } = await import("@/lib/operations/export");
      const bytes = await operationsExport(data, output);
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type":
            output === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${domain}-${data.today}.${output}"`,
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
    const domain = operationModules.parse((await params).module),
      envelope = mutationEnvelope.parse(await jsonBody(request)),
      command = parseCommand(domain, envelope.command);
    const filters =
      domain === "duty"
        ? dutyFilters.parse(Object.fromEntries(request.nextUrl.searchParams))
        : domain === "attendance"
          ? attendanceFilters.parse(
              Object.fromEntries(request.nextUrl.searchParams),
            )
          : domain === "mentoring"
            ? mentoringFilters.parse(
                Object.fromEntries(request.nextUrl.searchParams),
              )
            : {};
    const r = await createAuthAdmin().rpc("app_operations_write", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_request: envelope.requestId,
      p_revision: envelope.revision,
      p_module: domain,
      p_command: command as Json,
    });
    if (r.error) throw new Error("Mutation unavailable");
    const parsed = z
      .object({ code: z.string(), id: z.uuid().nullable().optional() })
      .safeParse(r.data);
    if (!parsed.success) {
      if (
        domain === "duty" ||
        domain === "attendance" ||
        domain === "mentoring"
      )
        throw new Error("Duty write unavailable");
      throw parsed.error;
    }
    const result = parsed.data;
    if (
      (domain === "duty" ||
        domain === "attendance" ||
        domain === "mentoring") &&
      ![
        "saved",
        "denied",
        "invalid",
        "duplicate",
        "not_found",
        "stale",
        "request_conflict",
      ].includes(result.code)
    )
      throw new Error("Duty acknowledgement unavailable");
    const data =
      (domain === "duty" ||
        domain === "attendance" ||
        domain === "mentoring") &&
      result.code === "saved"
        ? await operationsData(
            caller.principal.id,
            caller.sessionId,
            domain,
            filters,
          )
        : undefined;
    return reply(
      {
        result,
        ...(domain === "duty" ||
        domain === "attendance" ||
        domain === "mentoring"
          ? { code: result.code }
          : {}),
        ...(data ? { data } : {}),
        message:
          (domain === "duty"
            ? dutyMessages[result.code]
            : domain === "attendance"
              ? attendanceMessages[result.code]
              : domain === "mentoring"
                ? mentoringMessages[result.code]
                : undefined) ??
          operationMessages[result.code] ??
          "Perubahan belum berhasil.",
      },
      result.code === "saved" ? 200 : result.code === "denied" ? 403 : 409,
    );
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
