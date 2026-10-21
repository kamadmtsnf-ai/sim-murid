export function terbilang(n: number): string {
  return n === 0 ? "nol" : spell(n);
}
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export const object = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const amount = (n: unknown) =>
  new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
function spell(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Nominal tidak valid");
  const a = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];
  if (n < 12) return a[n] ?? "";
  if (n < 20) return spell(n - 10) + " belas";
  if (n < 100)
    return (spell(Math.floor(n / 10)) + " puluh " + spell(n % 10)).trim();
  if (n < 200) return ("seratus " + spell(n - 100)).trim();
  if (n < 1000)
    return (spell(Math.floor(n / 100)) + " ratus " + spell(n % 100)).trim();
  if (n < 2000) return ("seribu " + spell(n - 1000)).trim();
  for (const [v, label] of [
    [1e12, "triliun"],
    [1e9, "miliar"],
    [1e6, "juta"],
    [1000, "ribu"],
  ] as const)
    if (n >= v)
      return (
        spell(Math.floor(n / v)) +
        " " +
        label +
        " " +
        spell(n % v)
      ).trim();
  return "nol";
}
export function slipText(input: unknown) {
  const slip = object(input),
    s = object(slip.snapshot),
    t = object(s.transaction),
    fee = object(s.fee),
    owner = object(s.owner),
    school = object(s.school),
    identity = object(school.identity),
    address = object(school.address);
  return [
    String(school.name ?? "SiM-Murid"),
    [
      address.street,
      address.village,
      address.district,
      address.regency,
      address.province,
    ]
      .filter(Boolean)
      .join(", "),
    `NPSN: ${String(identity.npsn ?? "-")}`,
    "SLIP PENARIKAN " + String(slip.number),
    slip.reversed ? "DIBATALKAN / TELAH DIBALIK" : "",
    `Tanggal: ${String(t.transaction_date)}`,
    `Nasabah: ${String(owner.name)} (${String(owner.username)})`,
    `Nominal penarikan: Rp${amount(t.amount)}`,
    `Terbilang: ${terbilang(Number(t.amount)) || "nol"} rupiah`,
    `Biaya administrasi: Rp${amount(fee.fee)}`,
    `Uang diterima: Rp${amount(fee.cash)}`,
    `Saldo sebelum: Rp${amount(t.balance_before)}`,
    `Saldo sesudah: Rp${amount(t.balance_after)}`,
    `Pencatat: ${String(s.issuer)}`,
    `Keterangan: ${String(t.reason ?? "")}`,
    "Tanda tangan pencatat: ____________________",
    "Tanda tangan penerima: ____________________",
  ]
    .filter(Boolean)
    .join("\n");
}
export function htmlEscape(s: string) {
  return s.replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ] ?? x,
  );
}
export async function textPdf(sections: string[][]) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lines of sections) {
    let page = pdf.addPage([595, 842]),
      y = 795;
    for (const [index, line] of lines.entries()) {
      const safe = line.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
      let part = "";
      const draw = (s: string) => {
        if (y < 50) {
          page = pdf.addPage([595, 842]);
          y = 795;
        }
        page.drawText(s, {
          x: 40,
          y,
          size: index === 0 ? 15 : 10,
          font,
          color: rgb(0.08, 0.12, 0.2),
        });
        y -= index === 0 ? 28 : 18;
      };
      for (const word of safe.split(" ")) {
        if (font.widthOfTextAtSize(part + " " + word, 10) > 510 && part) {
          draw(part);
          part = word;
        } else part += (part ? " " : "") + word;
      }
      draw(part);
    }
  }
  return pdf.save();
}
export async function slipPdf(input: unknown) {
  return textPdf([slipText(input).split("\n")]);
}
export function grade(value: number, kkm: number) {
  if (value < kkm) return "D";
  if (value >= kkm + (2 * (100 - kkm)) / 3) return "A";
  if (value >= kkm + (100 - kkm) / 3) return "B";
  return "C";
}
export async function reportsPdf(
  rows: Record<string, unknown>[],
  kind = "combined",
) {
  if (!rows.length) throw new Error("Tidak ada rapor sesuai izin.");
  const sections = rows.map((r) => {
    const p = object(r.published),
      s = Object.keys(p).length ? object(p.snapshot) : object(r.draft),
      student = object(s.student),
      school = object(s.school),
      identity = object(school.identity),
      cls = object(s.class);
    if (!s.subjects) throw new Error("Rapor tidak tersedia.");
    const lines = [
      String(school.name ?? "SiM-Murid"),
      "RAPOR " + (s.draft ? "DRAFT / SEMENTARA" : "TERBIT"),
      String(student.name) + " — " + String(student.username),
      `Kelas ${String(cls.name)} | Tahun ${String(s.year)}/${Number(s.year) + 1} | Semester ${String(s.semester)}`,
      `Jenis: ${kind} | Kebijakan: RAPOR-1.0 (PH20%, ATS30%, ASAS50%; Praktik terpisah)`,
      "Mata pelajaran | Nilai | KKM | Predikat",
    ];
    for (const v of s.subjects as Record<string, unknown>[]) {
      const value =
        kind === "combined"
          ? v.final
          : v[
              (
                {
                  PH: "ph",
                  ATS: "ats",
                  ASAS: "asas",
                  Praktik: "practice",
                } as Record<string, string>
              )[kind] ?? kind
            ];
      lines.push(
        `${String(v.name)} | ${value === null || value === undefined ? "belum diisi" : String(value)} | ${String(v.kkm)} | ${value === null || value === undefined ? "-" : grade(Number(value), Number(v.kkm))}${v.complete ? "" : " (belum lengkap)"}`,
      );
      if (kind === "combined")
        lines.push(
          `  PH ${String(v.ph ?? "-")} | ATS ${String(v.ats ?? "-")} | ASAS ${String(v.asas ?? "-")} | Praktik ${String(v.practice ?? "-")}`,
        );
    }
    lines.push(
      "",
      `Kepala Madrasah: ${String(identity.head_name ?? "________________")}`,
      `NIP: ${String(identity.head_nip ?? "________________")}`,
      "Tanda tangan: ____________________",
    );
    return lines;
  });
  return textPdf(sections);
}
