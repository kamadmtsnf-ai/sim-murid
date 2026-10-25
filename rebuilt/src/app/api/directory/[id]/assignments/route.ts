import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import {
  assignmentCommand,
  assignmentRows,
} from "@/lib/education/teacher-assignments";
type Context = { params: Promise<{ id: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  if (write && !sameOrigin(request))
    return privateJson({ message: "Origin ditolak." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  if (!caller.principal.is_admin)
    return reply({ message: "Akses khusus admin." }, 403);
  try {
    const target = z.uuid().parse((await context.params).id);
    const command = write
      ? assignmentCommand.parse(await jsonBody(request, 4096))
      : null;
    const r = await createAuthAdmin().rpc("app_teacher_assignments", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
      p_target: target,
      p_command: command,
    });
    if (r.error) throw Error("Unavailable");
    const result = z
      .object({ code: z.string(), rows: assignmentRows.optional() })
      .parse(r.data);
    if (result.code !== "ok" || !result.rows) {
      const messages: Record<string, string> = {
        denied: "Akses khusus admin dengan keamanan akun lengkap.",
        not_found: "Guru atau penugasan tidak tersedia.",
        overlap: "Tugas yang sama sudah berlaku pada rentang tanggal tersebut.",
        request_conflict:
          "Identitas permintaan telah digunakan untuk perubahan berbeda.",
        invalid: "Isian penugasan tidak valid.",
      };
      return reply(
        {
          message: messages[result.code] ?? "Perubahan ditolak.",
          retryable: false,
        },
        result.code === "denied"
          ? 403
          : result.code === "not_found"
            ? 404
            : 409,
      );
    }
    return reply({ rows: result.rows, saved: write });
  } catch (error) {
    const e = failure(error);
    return reply(
      {
        message:
          e.status >= 500
            ? "Hasil belum dapat dipastikan. Coba kembali dengan permintaan yang sama."
            : e.message,
        retryable: e.status >= 500,
      },
      e.status,
    );
  }
}
export const GET = (r: NextRequest, c: Context) => handle(r, c, false);
export const POST = (r: NextRequest, c: Context) => handle(r, c, true);
