import {formatAcademicYear,semesterLabel} from '@/lib/academic/period';
import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { educationContext, failure } from "@/lib/education/server";
import { operationsData } from "@/lib/operations/server";
import { exportRows } from "@/lib/operations/export";
import { servicesData } from "@/lib/services/server";
import { serviceExportRows } from "@/lib/services/export";
import { learningData } from "@/lib/learning/server";
import { object } from "@/lib/learning/print";
export const runtime = "nodejs";
export const maxDuration = 60;
const querySchema = z
  .object({
    domains: z
      .string()
      .default("attendance,mentoring,fees,savings,discipline")
      .transform((v) => v.split(","))
      .pipe(
        z
          .array(
            z.enum([
              "attendance",
              "mentoring",
              "fees",
              "savings",
              "discipline",
              "reports",
              "survey-results",
            ]),
          )
          .min(1)
          .max(7),
      )
      .refine((v) => new Set(v).size === v.length),
    start: z.iso.date().optional(),
    end: z.iso.date().optional(),
    month: z.iso.date().optional(),
    classId: z.uuid().optional(),
    studentId: z.uuid().optional(),
    semester: z.coerce.number().int().min(1).max(2).optional(),
    periodId: z.uuid().optional(),
  })
  .strict();
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const f = querySchema.parse(
        Object.fromEntries(
          [...request.nextUrl.searchParams].filter(([, v]) => v !== ""),
        ),
      ),
      book = new ExcelJS.Workbook(),
      actor = caller.principal.id,
      session = caller.sessionId;
    function sheet(name: string, headers: string[], rows: unknown[][]) {
      if (rows.length > 10000)
        throw new RangeError("Ekspor melebihi batas; persempit filter.");
      const tab = book.addWorksheet(name);
      tab.addRow(headers);
      for (const r of rows)
        tab.addRow(r.map((v) => (typeof v === "number" ? v : String(v ?? ""))));
      tab.getRow(1).font = { bold: true };
      tab.views = [{ state: "frozen", ySplit: 1 }];
      tab.columns.forEach((c) => (c.width = 26));
    }
    const base = {
      ...(f.classId ? { classId: f.classId } : {}),
      ...(f.studentId ? { studentId: f.studentId } : {}),
      ...(f.start ? { start: f.start } : {}),
      ...(f.end ? { end: f.end } : {}),
    };
    for (const domain of f.domains) {
      if (["attendance", "mentoring", "fees", "savings"].includes(domain)) {
        const data = await operationsData(
          actor,
          session,
          domain as "attendance" | "mentoring" | "fees" | "savings",
          { ...base, export: true },
        );
        if (data.total > data.rows.length)
          throw new RangeError("Hasil parsial ditolak. Persempit filter.");
        const rows = exportRows(data);
        sheet(domain, rows.headers.map(String), rows.rows);
        sheet(
          domain + "-summary",
          ["Metrik", "Nilai"],
          Object.entries(data.summary),
        );
        if (domain === "fees" && Array.isArray(data.extra.months))
          sheet(
            "fees-months",
            ["Siswa", "Bulan", "Status", "Kas", "Tarif", "Tunggakan"],
            data.extra.months.map((v) => {
              const m = object(v);
              return [
                m.name,
                m.month,
                m.status,
                m.amount,
                m.tariff ?? "Tarif belum ditetapkan",
                m.outstanding ?? "Tarif belum ditetapkan",
              ];
            }),
          );
      } else if (domain === "discipline") {
        const data = await servicesData(actor, session, "discipline", {
            ...(f.month ? { month: f.month } : {}),
            ...(f.classId ? { classId: f.classId } : {}),
            ...(f.studentId ? { studentId: f.studentId } : {}),
          }),
          rows = serviceExportRows(data);
        sheet(domain, rows.columns, rows.rows);
      } else if (domain === "reports") {
        if (!f.classId) throw new RangeError("Pilih kelas untuk ekspor rapor.");
        const d = await learningData(actor, session, "reports", {
          classId: f.classId,
          ...(f.studentId ? { studentId: f.studentId } : {}),
          ...(f.semester ? { semester: f.semester } : {}),
        });
        const rows = d.rows.flatMap((r) => {
          const p = object(r.published),
            s = Object.keys(p).length ? object(p.snapshot) : object(r.draft);
          return (Array.isArray(s.subjects) ? s.subjects : []).map((v) => {
            const q = object(v);
            return [
              r.name,
              formatAcademicYear(s.year),
              semesterLabel(s.semester),
              s.draft ? "draft" : "terbit",
              q.name,
              q.ph,
              q.ats,
              q.asas,
              q.practice,
              q.final,
              q.kkm,
              q.grade,
            ];
          });
        });
        sheet(
          "reports",
          [
            "Siswa",
            "Tahun ajaran",
            "Semester",
            "Status",
            "Mapel",
            "PH",
            "ATS",
            "ASAS",
            "Praktik",
            "Rapor",
            "KKM",
            "Predikat",
          ],
          rows,
        );
      } else {
        if (!f.periodId) throw new RangeError("Pilih periode survei.");
        const d = await servicesData(actor, session, "insights", {
          periodId: f.periodId,
        });
        if (!d.isManager)
          return reply({ message: "Akses agregat ditolak." }, 403);
        const aggregates = Array.isArray(d.extra.aggregates)
          ? d.extra.aggregates.map(object)
          : [];
        sheet(
          "survey-results",
          ["Peran", "Aspek", "Kode", "Jumlah", "Rata-rata"],
          aggregates.map((r) => [r.role, r.aspect, r.code, r.n, r.mean]),
        );
      }
    }
    const info = book.addWorksheet("Keterangan");
    info.addRow(["Sumber", "Query terotorisasi per modul"]);
    info.addRow(["Filter", JSON.stringify(f)]);
    info.addRow([
      "Batas",
      "Hasil parsial ditolak; maksimum10.000baris per sheet",
    ]);
    const bytes = new Uint8Array(await book.xlsx.writeBuffer());
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      }),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="sim-murid-export.xlsx"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
