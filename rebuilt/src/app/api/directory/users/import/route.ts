import { userTemplate, importQuality } from "@/lib/spreadsheets/templates";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { createAuthAdmin } from "@/lib/auth/admin";
import { readExcel, decodeWorkbook } from "@/lib/spreadsheets/read";
import { excelBytes, EXCEL_MIME } from "@/lib/spreadsheets/write";
import {
  userHeaders,
  parseUserRows,
  userImportInstructions,
} from "@/lib/users/import";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handle(request: NextRequest, write = false) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  if (!caller.principal.is_admin)
    return reply(
      { message: "Hanya admin yang dapat mengimpor pengguna." },
      403,
    );
  try {
    const admin = createAuthAdmin();
    const allowed = await admin.rpc("app_education_admin", {
      p_actor: caller.principal.id,
      p_session: caller.sessionId,
    });
    if (allowed.error) throw Error("Unavailable");
    if (allowed.data !== true)
      return reply({ message: "Akses admin tidak berlaku." }, 403);
    if (!write) {
      const bytes = await excelBytes(userHeaders, [], userImportInstructions, userTemplate);
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type": EXCEL_MIME,
          "Content-Disposition":
            'attachment; filename="template-pengguna.xlsx"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    const { workbook } = z
      .object({ workbook: z.string().min(4).max(1398104) })
      .strict()
      .parse(await jsonBody(request, 1500000));
    let parsed;
    try {
      parsed = parseUserRows(
        await readExcel(decodeWorkbook(workbook), userHeaders, [
          "username",
          "full_name",
          "role",
          "contact_email",
        ], userTemplate),
      );
    } catch {
      return reply(
        {
          message:
            "Excel tidak valid. Gunakan template .xlsx terbaru tanpa formula, sheet Data, maksimal 1 MiB/100 baris. Username harus Text.",
        },
        400,
      );
    }
    if (parsed.issues.length)
      return reply(
        {
          message: "Perbaiki semua baris sebelum mengimpor.",
          issues: parsed.issues,
          quality: importQuality(parsed.count, parsed.issues.map(i=>i.row)),
        },
        422,
      );
    const found = await admin
      .from("profiles")
      .select("username")
      .in(
        "username",
        parsed.rows.map((r) => r.username),
      );
    if (found.error) throw Error("Unavailable");
    const existing = new Set(found.data.map((r) => r.username));
    const issues = parsed.rows.flatMap((r, i) =>
      existing.has(r.username)
        ? [{ row: i + 2, message: "Username sudah terdaftar." }]
        : [],
    );
    if (issues.length)
      return reply(
        {
          message:
            "Username existing tidak ditimpa. Hapus atau perbaiki baris tersebut.",
          issues,
          quality: importQuality(parsed.count, issues.map(i=>i.row)),
        },
        422,
      );
    return reply({ rows: parsed.rows, count: parsed.count, quality: importQuality(parsed.count, []) });
  } catch (e) {
    const err = failure(e);
    return reply({ message: err.message }, err.status);
  }
}
export function GET(request: NextRequest) {
  return handle(request);
}
export function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  return handle(request, true);
}
