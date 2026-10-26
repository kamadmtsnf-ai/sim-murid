import ExcelJS from "exceljs";
import { templateMarker, type TemplateIdentity } from "./templates.ts";
export type ExcelLayout = { wrapText?: boolean };
export const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Every value is a scalar: strings beginning '=' remain text, never executable formulas. */
export async function excelBytes(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
  instructions: readonly string[] = [],
  template?: TemplateIdentity,
  layout: ExcelLayout = {},
) {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Data", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF125E64" },
  };
  sheet.columns = headers.map((h) => ({
    width: Math.min(42, Math.max(20, h.length + 4)),
    style: { numFmt: "@" },
  }));
  if (layout.wrapText) sheet.getColumn(headers.length).width = 64;
  for (const row of rows) {
    const added = sheet.addRow([...row]);
    if (layout.wrapText) {
      added.alignment = { wrapText: true, vertical: "top" };
      const lines = Math.max(1, ...row.map((value,i)=>String(value??"").split("\n").reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/(sheet.getColumn(i+1).width??20))),0)));
      added.height = Math.min(409, Math.max(30, lines*16+8));
    }
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: headers.length },
  };
  if (instructions.length || template) {
    const guide = book.addWorksheet("Panduan");
    guide.getColumn(1).width = 100;
    for (const text of [...(template ? [templateMarker(template), `Template ${template.id} · versi ${template.version}`] : []), ...instructions]) {
      const row = guide.addRow([text]);
      row.height = 42;
    }
    guide.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
export async function downloadExcel(
  name: string,
  headers: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
  instructions: readonly string[] = [],
  layout: ExcelLayout = {},
) {
  const bytes = await excelBytes(headers, rows, instructions, undefined, layout);
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: EXCEL_MIME }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
