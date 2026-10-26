import "server-only";
import { verifyTemplateMarkers, type TemplateIdentity } from "./templates.ts";
import { crc32, inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
export const MAX_EXCEL_BYTES = 1048576;
const MAX_EXPANDED = 8388608;
/** Bound actual decompression before ExcelJS/JSZip allocates XML, not just declared ZIP sizes. */
export function inspectExcelZip(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.length < 22 || b.length > MAX_EXCEL_BYTES)
    throw Error("Berkas Excel maksimal 1 MiB.");
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (
      b.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + b.readUInt16LE(i + 20) === b.length
    ) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    b.readUInt16LE(end + 4) ||
    b.readUInt16LE(end + 6) ||
    b.readUInt16LE(end + 8) !== b.readUInt16LE(end + 10)
  )
    throw Error("ZIP Excel tidak valid.");
  const entries = b.readUInt16LE(end + 10),
    length = b.readUInt32LE(end + 12),
    start = b.readUInt32LE(end + 16);
  if (!entries || entries > 512 || start + length !== end)
    throw Error("Struktur Excel tidak didukung.");
  let p = start,
    total = 0;
  const seen = new Set<string>();
  for (let i = 0; i < entries; i++) {
    if (p + 46 > end || b.readUInt32LE(p) !== 0x02014b50)
      throw Error("ZIP tidak valid.");
    const flags = b.readUInt16LE(p + 8),
      method = b.readUInt16LE(p + 10),
      checksum = b.readUInt32LE(p + 16),
      compressed = b.readUInt32LE(p + 20),
      expanded = b.readUInt32LE(p + 24),
      n = b.readUInt16LE(p + 28),
      extra = b.readUInt16LE(p + 30),
      comment = b.readUInt16LE(p + 32),
      offset = b.readUInt32LE(p + 42);
    if (p + 46 + n + extra + comment > end) throw Error("ZIP tidak valid.");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      b.subarray(p + 46, p + 46 + n),
    );
    p += 46 + n + extra + comment;
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      seen.has(name) ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      /vbaProject|externalLinks|embeddings|activeX/i.test(name)
    )
      throw Error("Makro, tautan eksternal atau entri ZIP tidak didukung.");
    seen.add(name);
    total += expanded;
    if (
      total > MAX_EXPANDED ||
      offset + 30 > start ||
      b.readUInt32LE(offset) !== 0x04034b50
    )
      throw Error("Excel terlalu besar atau rusak.");
    const ln = b.readUInt16LE(offset + 26),
      le = b.readUInt16LE(offset + 28),
      data = offset + 30 + ln + le;
    if (
      data + compressed > start ||
      b.subarray(offset + 30, offset + 30 + ln).toString("utf8") !== name ||
      b.readUInt16LE(offset + 8) !== method
    )
      throw Error("ZIP tidak valid.");
    const raw =
      method === 0
        ? b.subarray(data, data + compressed)
        : inflateRawSync(b.subarray(data, data + compressed), {
            maxOutputLength: Math.max(1, Math.min(MAX_EXPANDED, expanded + 1)),
          });
    if ((crc32(raw) >>> 0) !== checksum) throw Error("Checksum ZIP tidak cocok.");
    if (raw.length !== expanded) throw Error("Ukuran ZIP tidak cocok.");
    if (
      /\.(xml|rels)$/i.test(name) &&
      /<!DOCTYPE|<!ENTITY|TargetMode\s*=|macroEnabled|vbaProject/i.test(
        raw.toString("utf8"),
      )
    )
      throw Error("Konten eksternal Excel tidak diizinkan.");
  }
  if (
    p !== end ||
    !seen.has("[Content_Types].xml") ||
    !seen.has("xl/workbook.xml")
  )
    throw Error("Gunakan berkas .xlsx yang valid.");
}
export function decodeWorkbook(value: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4)
    throw Error("Berkas tidak valid.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw Error("Berkas tidak valid.");
  return bytes;
}
export async function readExcel(
  bytes: Uint8Array,
  headers: readonly string[],
  textColumns: readonly string[],
  template?: TemplateIdentity,
) {
  inspectExcelZip(bytes);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as never);
  const sheet = book.getWorksheet("Data");
  if (
    !sheet ||
    sheet.state !== "visible" ||
    book.worksheets.some((s) => !["Data", "Panduan"].includes(s.name)) ||
    sheet.rowCount > 101 ||
    sheet.columnCount !== headers.length
  )
    throw Error("Gunakan sheet Data dari template, maksimal 100 baris.");
  if (template) {
    const markers: unknown[] = [];
    book.getWorksheet("Panduan")?.eachRow((row) => { markers.push(row.getCell(1).value); });
    verifyTemplateMarkers(markers, template);
  }
  const records: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, n) => {
    if (n > 101 || row.cellCount > headers.length)
      throw Error("Kolom/baris berlebih.");
    const values = headers.map((header, i) => {
      const v = row.getCell(i + 1).value;
      if (v === null || v === undefined) return "";
      if (typeof v !== "string" && typeof v !== "number")
        throw Error(
          "Gunakan teks/angka biasa, tanpa formula, hyperlink atau tanggal otomatis.",
        );
      if (n > 1 && textColumns.includes(header) && typeof v !== "string")
        throw Error(
          "Username dan identitas harus berformat Text; nol awal tidak boleh hilang.",
        );
      if (typeof v === "number" && !Number.isFinite(v))
        throw Error("Angka tidak valid.");
      if (String(v).length > 4000) throw Error("Isian terlalu panjang.");
      return String(v);
    });
    records.push(values);
  });
  if (JSON.stringify(records[0]) !== JSON.stringify(headers))
    throw Error("Header harus sama persis dengan template Excel.");
  if (records.length < 2 || records.length > 101)
    throw Error("Isi 1–100 baris setelah header.");
  return records;
}
