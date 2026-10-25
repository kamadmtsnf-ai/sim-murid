import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { educationContext, jsonBody, failure } from "@/lib/education/server";
import { bulkDomains, headers, bulkTemplates } from "@/lib/bulk/validation";
import { parseBulkRows } from "@/lib/bulk/rows";
import { readExcel, decodeWorkbook } from "@/lib/spreadsheets/read";
import { excelBytes, EXCEL_MIME } from "@/lib/spreadsheets/write";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan tidak diizinkan." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const b = z
      .object({ domain: bulkDomains, workbook: z.string().min(4).max(1398104) })
      .strict()
      .parse(await jsonBody(request, 1500000));
    const records = await readExcel(
      decodeWorkbook(b.workbook),
      headers[b.domain],
      ["username", "teacher_username"],
    );
    return reply({ preview: parseBulkRows(records, b.domain) });
  } catch {
    return reply(
      {
        message:
          "Excel tidak valid. Gunakan template .xlsx, sheet Data, tanpa formula, maksimal 1 MiB dan 100 baris. Username wajib Text.",
      },
      400,
    );
  }
}
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const domain = bulkDomains.parse(
      request.nextUrl.searchParams.get("domain"),
    );
    const bytes = await excelBytes(headers[domain], bulkTemplates[domain], [
      "Isi sheet Data. Hapus baris contoh sebelum mengimpor.",
      "Pertahankan header dan format Text untuk username, kode, serta jam HH:mm. Maksimal 100 baris, 1 MiB.",
      "Jangan gunakan formula, makro, hyperlink atau kolom tambahan.",
    ]);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": EXCEL_MIME,
        "Content-Disposition": `attachment; filename="template-${domain}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const err = failure(e);
    return reply({ message: err.message }, err.status);
  }
}
