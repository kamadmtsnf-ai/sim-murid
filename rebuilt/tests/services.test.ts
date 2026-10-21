import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as id } from "node:crypto";
import { commands, snapshot } from "../src/lib/services/validation.ts";
import questions from "../src/lib/services/question-seed.json" with { type: "json" };
import {
  serviceExportRows,
  exportServices,
} from "../src/lib/services/export.ts";
import { reconcile } from "../scripts/release/reconcile.mjs";
import { PDFDocument } from "pdf-lib";
test("Service DTO: forged actor, stale-shaped version, invalid scale, blank policy inputs rejected", () => {
  assert.throws(() =>
    commands.discipline.parse({
      type: "event",
      studentId: id(),
      date: "2026-10-21",
      code: "A01",
      notes: "",
      actorId: id(),
    }),
  );
  assert.throws(() =>
    commands.surveys.parse({
      type: "save",
      periodId: id(),
      version: -1,
      answers: {},
    }),
  );
  assert.throws(() =>
    commands.surveys.parse({
      type: "save",
      periodId: id(),
      version: 0,
      answers: { "A1-1": 0 },
    }),
  );
  assert.throws(() =>
    commands.insights.parse({ type: "plan", periodId: id(), items: [] }),
  );
});
test("Canonical full bank:206 unique role/code, exact essay and attention policies", () => {
  assert.equal(questions.length, 206);
  assert.equal(new Set(questions.map((q) => q.role + ":" + q.code)).size, 206);
  assert.equal(
    questions.find((q) => q.role === "student" && q.code === "ATT-2")
      ?.attention,
    5,
  );
  assert.equal(
    questions.filter((q) => q.role === "student" && q.section === "D").length,
    16,
  );
  assert.equal(
    questions.filter((q) => q.role === "teacher" && q.kind === "essay").length,
    5,
  );
  assert.ok(questions.every((q) => q.required));
});
test("Export scope, zero preservation, CSV injection escaping, XLSX and PDF open", async () => {
  const s = snapshot.parse({
    module: "discipline",
    revision: 0,
    today: "2026-10-21",
    isAdmin: true,
    isManager: true,
    month: "2026-10-01",
    rows: [
      {
        student_id: id(),
        name: "=BAD()",
        class_name: "7A",
        snapshot: { balance: 0, level: 5, violations: 4, good: 0 },
      },
    ],
    extra: {},
    years: [],
    classes: [],
    subjects: [],
  });
  assert.equal(serviceExportRows(s).rows[0]?.[3], 0);
  const csv = await (await exportServices(s, "csv")).text();
  assert.ok(csv.includes("'=BAD()"));
  const { default: ExcelJS } = await import("exceljs"),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(
    Buffer.from(
      await (await exportServices(s, "xlsx")).arrayBuffer(),
    ) as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  assert.equal(book.worksheets[0]?.getRow(2).getCell(1).value, "=BAD()");
  assert.equal(
    (
      await PDFDocument.load(
        await (await exportServices(s, "pdf")).arrayBuffer(),
      )
    ).getPageCount(),
    1,
  );
});
test("Reconciliation never passes missing evidence, orphans, money mismatch or username collisions", () => {
  const base = {
    entities: { users: { count: 2, orphans: 0, digest: "abc" } },
    usernames: ["001", "002"],
    savingsBalances: { a: "100000" },
    feeCash: "0",
    feeAllocations: [],
    gradesByPeriod: [],
    pointReplay: [],
    surveyProgress: [],
    documentChecksums: [],
    documentAccess: [],
  };
  assert.equal(reconcile(base, base).status, "matched");
  assert.throws(() => reconcile({}, {}));
  assert.equal(
    reconcile({ ...base, usernames: ["A", "a"] }, base).status,
    "blocked",
  );
  assert.equal(
    reconcile(base, { ...base, savingsBalances: { a: "99999" } }).status,
    "blocked",
  );
});


test('AI result preserves categorical legacy sentiment and rejects numeric substitution',async()=>{const {analysisSchema}=await import('../src/lib/services/analysis-schema.ts');const value={ringkasan_umum:'Ringkasan',tema_positif:[],tema_perlu_perhatian:[],kutipan_representatif:[],rekomendasi_tindakan:[],skor_sentimen_keseluruhan:'campuran'};assert.equal(analysisSchema.parse(value).skor_sentimen_keseluruhan,'campuran');assert.throws(()=>analysisSchema.parse({...value,skor_sentimen_keseluruhan:.5}));});
