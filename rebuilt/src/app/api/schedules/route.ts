import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  educationContext,
  jsonBody,
  failure,
  resultSchema,
  domainMessages,
  schedulesData,
} from "@/lib/education/server";
import { scheduleCommand, mutation } from "@/lib/education/validation";
async function handle(request: NextRequest, mutate: boolean) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Sesi tidak berlaku." }, 401);
  try {
    const year = request.nextUrl.searchParams.get("year");
    if (year) z.uuid().parse(year);
    const filters = {
      ...(year ? { year } : {}),
      ...(request.nextUrl.searchParams.get("class")
        ? { classId: z.uuid().parse(request.nextUrl.searchParams.get("class")) }
        : {}),
      ...(request.nextUrl.searchParams.get("day")
        ? {
            weekday: z.coerce
              .number()
              .int()
              .min(1)
              .max(7)
              .parse(request.nextUrl.searchParams.get("day")),
          }
        : {}),
      personal: request.nextUrl.searchParams.get("personal") === "1",
    };
    const args = { p_actor: caller.principal.id, p_session: caller.sessionId };
    if (mutate) {
      const input = mutation(scheduleCommand).parse(await jsonBody(request));
      const command = scheduleCommand.parse(input.command);
      const r = await createAuthAdmin().rpc("app_schedules_write", {
        ...args,
        p_request: input.requestId,
        p_revision: input.revision,
        p_command: command,
      });
      if (r.error) throw new Error("Write unavailable");
      const parsed = resultSchema.safeParse(r.data);
      if (!parsed.success) throw new Error("Write result unavailable");
      const result = parsed.data;
      if (result.code !== "saved")
        return reply(
          {
            code: result.code,
            message:
              domainMessages[result.code] ?? "Permintaan belum berhasil.",
          },
          result.code === "denied" ? 403 : 409,
        );
    }
    return reply({
      ...(mutate ? {code:"saved"} : {}),
      schedules: await schedulesData(args.p_actor, args.p_session, filters),
      message: mutate ? "Data berhasil disimpan." : "",
    });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
export async function GET(request: NextRequest) {
  return handle(request, false);
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  return handle(request, true);
}
