import { surveysSnapshot, surveyResponse } from "@/lib/services/surveys";
import { disciplineFilters } from "@/lib/services/discipline";
import { z } from "zod";
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
      domain === "discipline" ? disciplineFilters.parse(query) : query,
    );
    if (
      format === "certificate" &&
      domain === "discipline" &&
      !(data.extra.ranking as Record<string, unknown>[]).some(
        (r) => Number(r.class_rank) <= 2 || Number(r.global_rank) <= 3,
      )
    )
      return reply(
        { message: "Belum ada penerima sertifikat sesuai filter." },
        404,
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
      body = mutationEnvelope.parse(
        await jsonBody(request, domain === "surveys" ? 4194304 : 65536),
      ),
      command = commands[domain].parse(body.command),
      readFilters =
        domain === "discipline"
          ? disciplineFilters.parse(
              Object.fromEntries(request.nextUrl.searchParams),
            )
          : domain === "insights"
            ? {
                ...Object.fromEntries(request.nextUrl.searchParams),
                ...("periodId" in command
                  ? { periodId: command.periodId }
                  : {}),
              }
            : undefined,
      r = await createAuthAdmin().rpc("app_services_write", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
        p_request: body.requestId,
        p_revision: body.revision,
        p_module: domain,
        p_command: command as Json,
      });
    if (r.error) throw new Error("Unavailable");
    const result = r.data as {
      code: string;
      added?: number;
      response?: Record<string, unknown>;
    };
    if (
      (domain === "discipline" ||
        domain === "surveys" ||
        domain === "insights") &&
      !z
        .object({
          code: z.enum([
            "saved",
            "denied",
            "stale",
            "locked",
            "archived",
            "invalid",
            "not_found",
            "not_configured",
            "duplicate",
            "request_conflict",
            ...(domain === "surveys"
              ? (["incomplete", "peer_incomplete", "exam_warning"] as const)
              : []),
          ]),
        })
        .safeParse(result).success
    )
      throw Error("Uncertain acknowledgement");
    const data =
      (domain === "discipline" ||
        domain === "surveys" ||
        domain === "insights") &&
      result.code === "saved"
        ? await servicesData(
            caller.principal.id,
            caller.sessionId,
            domain,
            readFilters,
          )
        : undefined;
    if (domain === "insights" && result.code === "saved") {
      const cmd = commands.insights.parse(command);
      if (!data) throw Error("Missing insight readback");
      if (cmd.type === "note") {
        const progress = Array.isArray(data.extra.progress)
          ? (data.extra.progress as Record<string, unknown>[])
          : [];
        if (
          !progress.some((r) => r.user_id === cmd.userId && r.note === cmd.note)
        )
          throw Error("Note not confirmed");
      } else {
        const plan = Array.isArray(data.extra.plan)
          ? (data.extra.plan as Record<string, unknown>[])
          : [];
        if (
          cmd.type === "plan_status" &&
          plan[cmd.index]?.status !== cmd.status
        )
          throw Error("Plan status not confirmed");
        if (
          cmd.type === "plan" &&
          (plan.length !== cmd.items.length ||
            cmd.items.some((item, i) =>
              Object.entries(item).some(([k, v]) => plan[i]?.[k] !== v),
            ))
        )
          throw Error("Plan not confirmed");
      }
    }
    if (domain === "surveys" && result.code === "saved") {
      const cmd = commands.surveys.parse(command),
        state = surveysSnapshot.parse(data);
      const ack = z
        .object({
          id: z.uuid().optional(),
          version: z.number().int().optional(),
        })
        .safeParse(result);
      if (!ack.success) throw Error("Invalid survey acknowledgement");
      const period = state.rows.find(
        (p) => p.id === (cmd.type === "period" ? ack.data.id : cmd.periodId),
      );
      if (!period) throw Error("Missing survey readback");
      if (
        cmd.type === "period" &&
        (!ack.data.id || (cmd.periodId && cmd.periodId !== ack.data.id))
      )
        throw Error("Wrong period");
      if (
        cmd.type === "period" &&
        (period.title !== cmd.title ||
          period.academic_year_id !== cmd.yearId ||
          period.semester !== cmd.semester ||
          period.starts_on !== cmd.start ||
          period.ends_on !== cmd.end)
      )
        throw Error("Period not confirmed");
      if (
        cmd.type === "close" &&
        (ack.data.id !== cmd.periodId || period.status !== "closed")
      )
        throw Error("Close not confirmed");
      if (cmd.type === "start") {
        const r = surveyResponse.safeParse(result.response);
        if (
          !r.success ||
          r.data.user_id !== caller.principal.id ||
          r.data.period_id !== cmd.periodId ||
          !period.response
        )
          throw Error("Start not confirmed");
      }
      if ("version" in cmd) {
        const r = period.response;
        if (
          !r ||
          ack.data.version !== cmd.version + 1 ||
          r.revision !== ack.data.version
        )
          throw Error("Version not confirmed");
        const actual = cmd.type.startsWith("peer_")
          ? r.peer_answers
          : r.answers;
        const equal = (a: unknown, b: unknown): boolean =>
          a === b ||
          (!!a &&
            !!b &&
            typeof a === "object" &&
            typeof b === "object" &&
            Object.keys(a).length === Object.keys(b).length &&
            Object.entries(a).every(([k, v]) =>
              equal(v, (b as Record<string, unknown>)[k]),
            ));
        if (!equal(actual, cmd.answers)) throw Error("Answers not confirmed");
        if (cmd.type === "submit" && !r.submitted_at)
          throw Error("Final not confirmed");
        if (cmd.type === "peer_submit" && !r.peer_submitted_at)
          throw Error("Peer final not confirmed");
      }
    }
    if (domain === "surveys" && result.response)
      delete result.response.admin_note;
    return reply(
      {
        result,
        ...(domain === "discipline" ||
        domain === "surveys" ||
        domain === "insights"
          ? { code: result.code, ...(data ? { data } : {}) }
          : {}),
        message:
          (messages[result.code] ?? "Permintaan belum berhasil.") +
          (domain === "discipline" &&
          result.code === "saved" &&
          Number.isSafeInteger(result.added)
            ? ` Jumlah data ditambahkan: ${result.added}.`
            : ""),
      },
      result.code === "saved" ? 200 : result.code === "denied" ? 403 : 409,
    );
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
