import { formatAcademicYear, semesterLabel } from "../academic/period.ts";
import ExcelJS from "exceljs";
import { z } from "zod";
import { textPdf, object } from "../learning/print.ts";
import type { ServiceSnapshot } from "./validation.ts";
export function serviceExportRows(data: ServiceSnapshot) {
  if (data.rows.length > 10000)
    throw new RangeError("Ekspor melebihi batas; persempit filter.");
  if (data.module === "discipline")
    return {
      columns: [
        "Siswa",
        "Kelas",
        "Bulan",
        "Saldo",
        "Level",
        "Pelanggaran",
        "Kebaikan",
      ],
      rows: data.rows.map((r) => {
        const s = object(r.snapshot);
        return [
          r.name,
          r.class_name,
          data.month,
          s.balance,
          s.level,
          s.violations,
          s.good,
        ];
      }),
    };
  if (data.module === "surveys")
    return {
      columns: [
        "Periode",
        "Tahun ajaran",
        "Semester",
        "Mulai",
        "Selesai",
        "Status",
        "Rincian",
      ],
      rows: data.rows.map((r) => [
        r.title,
        formatAcademicYear(
          data.years?.find((y) => y.id === r.academic_year_id)?.start_year,
        ),
        semesterLabel(r.semester),
        r.starts_on,
        r.ends_on,
        r.status,
        JSON.stringify(r),
      ]),
    };
  return {
    columns: ["Data", "Rincian"],
    rows: data.rows.map((r) => [
      r.name ?? r.title ?? r.id ?? "",
      JSON.stringify(r),
    ]),
  };
}
export async function exportServices(data: ServiceSnapshot, input: string) {
  const format = z.enum(["csv", "xlsx", "pdf", "certificate"]).parse(input),
    table = serviceExportRows(data);
  let bytes: Uint8Array | string, mime: string;
  if (format === "csv") {
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    bytes =
      "\uFEFF" +
      [table.columns, ...table.rows]
        .map((r) => r.map(cell).join(","))
        .join("\r\n");
    mime = "text/csv; charset=utf-8";
  } else if (format === "xlsx") {
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Laporan");
    sheet.addRow(table.columns);
    for (const row of table.rows)
      sheet.addRow(
        row.map((v) => (typeof v === "number" ? v : String(v ?? ""))),
      );
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 28));
    bytes = new Uint8Array(await book.xlsx.writeBuffer());
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    let sections: string[][];
    if (format === "certificate") {
      if (data.module !== "discipline")
        throw new Error("Akses sertifikat tidak diizinkan.");
      const ranking = Array.isArray(data.extra.ranking)
        ? data.extra.ranking.map(object)
        : [];
      sections = ranking
        .filter((r) => Number(r.class_rank) <= 2 || Number(r.global_rank) <= 3)
        .map((r) => {
          const s = object(r.x);
          return [
            "SERTIFIKAT STUDENT OF THE MONTH",
            String(s.name),
            `Bulan ${data.month} | Kelas ${String(s.class_name)}`,
            `Peringkat kelas ${String(r.class_rank)} | Peringkat global ${String(r.global_rank)}`,
            `Saldo ${String(object(s.snapshot).balance)}`,
            "Kepala Madrasah: ____________________",
            "Tanda tangan: ____________________",
          ];
        });
      if (!sections.length)
        throw new Error("Tidak ada penerima sesuai filter.");
    } else
      sections = [
        [
          `SiM-Murid — ${data.module}`,
          `Periode ${data.month}`,
          ...(data.module === "discipline" ? [table.columns.join(" | ")] : []),
          ...table.rows.map((r) => r.map((v) => String(v ?? "")).join(" | ")),
        ],
      ];
    bytes = await textPdf(
      data.module === "discipline"
        ? sections.map((lines) =>
            lines.map((line) =>
              line.replace(/\S{41,}/g, (word) =>
                word.match(/.{1,40}/g)!.join(" "),
              ),
            ),
          )
        : sections,
    );
    mime = "application/pdf";
  }
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${data.module}.${format === "certificate" ? "pdf" : format}"`,
      "Cache-Control": "no-store",
    },
  });
}
