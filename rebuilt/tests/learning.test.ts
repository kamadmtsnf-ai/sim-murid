import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as id } from "node:crypto";
import {
  commands,
  assetPrepare,
  learningFilters,
  diplomaFields,
} from "../src/lib/learning/validation.ts";
import {
  terbilang,
  grade,
  slipPdf,
  reportsPdf,
  htmlEscape,
} from "../src/lib/learning/print.ts";
import { PDFDocument } from "pdf-lib";
test("Learning DTO rejects forged scores, scope, unsafe URLs, duplicate and oversized batches", () => {
  const cmd = {
    type: "batch",
    id: null,
    classId: id(),
    subjectId: id(),
    date: "2026-10-21",
    kind: "PH",
    items: [{ studentId: id(), value: 0 }],
  };
  const parsed = commands.grades.parse(cmd);
  assert.ok(parsed.type === "batch");
  assert.equal(parsed.items[0]?.value, 0);
  assert.throws(() => commands.grades.parse({ ...cmd, actorId: id() }));
  assert.throws(() =>
    commands.grades.parse({ ...cmd, items: [...cmd.items, ...cmd.items] }),
  );
  assert.throws(() =>
    commands.grades.parse({ ...cmd, items: [{ studentId: id(), value: 101 }] }),
  );
  assert.throws(() => commands.grades.parse({ ...cmd, date: "2026-02-30" }));
  assert.throws(() => learningFilters.parse({ semester: 3 }));
  assert.throws(() =>
    assetPrepare.parse({
      action: "prepare",
      kind: "book",
      targetId: id(),
      filename: "x.jpg",
      mime: "image/jpeg",
      size: 100,
    }),
  );
  assert.equal(diplomaFields.length, 13);
});
test("Terbilang currency boundaries and KKM100 grade edge", () => {
  for (const [n, s] of [
    [0, "nol"],
    [11, "sebelas"],
    [20, "dua puluh"],
    [100, "seratus"],
    [1000, "seribu"],
    [123000, "seratus dua puluh tiga ribu"],
    [1000000, "satu juta"],
  ] as const)
    assert.equal(terbilang(n), s);
  assert.throws(() => terbilang(-1));
  assert.equal(grade(100, 100), "A");
  assert.equal(grade(99, 100), "D");
  assert.equal(grade(75, 75), "C");
  assert.equal(htmlEscape("<script>"), "&lt;script&gt;");
});
test("Slip and report PDF one/selected/all render valid immutable snapshots", async () => {
  const slip = {
    number: "S-00000001",
    snapshot: {
      transaction: {
        amount: 123000,
        transaction_date: "2026-10-21",
        balance_before: 200000,
        balance_after: 77000,
      },
      fee: { fee: 1000, cash: 122000 },
      owner: { name: "Siswa", username: "siswa" },
      school: { name: "Madrasah" },
      issuer: "Admin",
    },
  };
  const pdf = await PDFDocument.load(await slipPdf(slip));
  assert.equal(pdf.getPageCount(), 1);
  const draft = {
    draft: true,
    student: { name: "Siswa", username: "siswa" },
    class: { name: "7A" },
    year: 2026,
    semester: 1,
    subjects: [
      {
        name: "Mapel",
        ph: 80,
        ats: 70,
        asas: 90,
        practice: 0,
        final: 82,
        kkm: 75,
        complete: true,
      },
    ],
    school: { name: "Madrasah" },
  };
  for (const kind of ["combined", "PH", "ATS", "ASAS", "Praktik"])
    assert.equal(
      (
        await PDFDocument.load(await reportsPdf([{ draft }], kind))
      ).getPageCount(),
      1,
    );
  assert.equal(
    (
      await PDFDocument.load(
        await reportsPdf([
          { draft },
          { published: { snapshot: { ...draft, draft: false } } },
        ]),
      )
    ).getPageCount(),
    2,
  );
  await assert.rejects(reportsPdf([]));
});
