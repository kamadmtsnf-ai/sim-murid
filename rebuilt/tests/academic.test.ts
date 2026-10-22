import { test } from "node:test";
import assert from "node:assert/strict";
import {
  academicYearInput,
  formatAcademicYear,
  semesterLabel,
  semesterPeriod,
  academicPeriodForDate,
  defaultSemesterDate,
} from "../src/lib/academic/period.ts";
import { classCommand } from "../src/lib/education/validation.ts";
import { commands, snapshot } from "../src/lib/services/validation.ts";
import { serviceExportRows } from "../src/lib/services/export.ts";
test("Academic year input accepts consecutive slash/hyphen pairs and normalizes public values", () => {
  for (const text of ["2026/2027", "2026-2027", " 2026 / 2027 "])
    assert.equal(academicYearInput.parse(text), "2026/2027");
  for (const text of [
    "2026",
    "2026/2026",
    "2026/2028",
    "2027/2026",
    "1899/1900",
    "2200/2201",
    "2026/2027/2028",
  ])
    assert.equal(academicYearInput.safeParse(text).success, false);
  assert.equal(formatAcademicYear(2026), "2026/2027");
  assert.equal(formatAcademicYear("2026-2027"), "2026/2027");
  assert.equal(formatAcademicYear(undefined), "—");
  assert.equal(formatAcademicYear("2026/2029"), "—");
});
test("Year command normalizes paired public input without changing legacy RPC contracts", () => {
  for (const academicYear of ["2026/2027", "2026-2027"])
    assert.deepEqual(classCommand.parse({ type: "year", academicYear }), {
      type: "year",
      startYear: 2026,
    });
  assert.deepEqual(classCommand.parse({ type: "year", startYear: 2026 }), {
    type: "year",
    startYear: 2026,
  });
  for (const command of [
    { type: "year", academicYear: "2026" },
    { type: "year", academicYear: "2026/2028" },
    { type: "year", academicYear: "2026/2027", startYear: 2025 },
    { type: "year", academicYear: "2026/2027", actor: "forged" },
  ])
    assert.equal(classCommand.safeParse(command).success, false);
});
test("Ganjil and Genap belong to the two calendar halves of the same academic year", () => {
  assert.equal(semesterLabel(1), "Ganjil");
  assert.equal(semesterLabel("2"), "Genap");
  assert.deepEqual(semesterPeriod(2026, 1), {
    start: "2026-07-01",
    end: "2026-12-31",
    label: "Ganjil · Juli–Desember 2026",
  });
  assert.deepEqual(semesterPeriod("2026/2027", 2), {
    start: "2027-01-01",
    end: "2027-06-30",
    label: "Genap · Januari–Juni 2027",
  });
  for (const [date, year, sem] of [
    ["2026-06-30", 2025, 2],
    ["2026-07-01", 2026, 1],
    ["2026-12-31", 2026, 1],
    ["2027-01-01", 2026, 2],
    ["2027-06-30", 2026, 2],
    ["2027-07-01", 2027, 1],
    ["2028-02-29", 2027, 2],
  ] as const) {
    const p = academicPeriodForDate(date)!;
    assert.equal(p.startYear, year);
    assert.equal(p.semester, sem);
  }
  assert.equal(academicPeriodForDate("2027-02-29"), null);
});
test("Default assessment dates stay inside the selected semester even across January and historical classes", () => {
  assert.equal(defaultSemesterDate(2026, 2, "2026-10-22"), "2027-01-01");
  assert.equal(defaultSemesterDate(2026, 1, "2027-02-01"), "2026-07-01");
  assert.equal(defaultSemesterDate(undefined, 2, "2027-02-01"), "2027-02-01");
  assert.equal(defaultSemesterDate(2025, 2, "2027-02-01"), "2026-01-01");
});
test("Survey command rejects semester-crossing and mismatched calendar halves before writes", () => {
  const base = {
    type: "period",
    periodId: null,
    title: "Semester test",
    yearId: "00000000-0000-4000-8000-000000000010",
    semester: 1,
    start: "2026-07-01",
    end: "2026-12-31",
    targets: ["student"],
    kind: "main",
    questions: null,
    examOverride: "",
  };
  assert.ok(commands.surveys.safeParse(base).success);
  for (const patch of [
    { end: "2027-01-01" },
    { start: "2026-01-01" },
    { semester: 2 },
    { end: "2026-06-30" },
  ])
    assert.equal(
      commands.surveys.safeParse({ ...base, ...patch }).success,
      false,
    );
  assert.ok(
    commands.surveys.safeParse({
      ...base,
      semester: 2,
      start: "2027-01-01",
      end: "2027-06-30",
    }).success,
  );
});
test("Survey exports use the same year and semester labels without dropping row details", () => {
  const data = snapshot.parse({
    module: "surveys",
    revision: 1,
    today: "2026-10-22",
    isAdmin: true,
    isManager: true,
    month: "2026-10-01",
    rows: [
      {
        id: "period",
        title: "Evaluasi",
        academic_year_id: "year",
        semester: 2,
        starts_on: "2027-01-01",
        ends_on: "2027-06-30",
        status: "open",
      },
    ],
    extra: {},
    years: [{ id: "year", start_year: 2026 }],
    classes: [],
    subjects: [],
  });
  const table = serviceExportRows(data);
  assert.ok(table.columns.includes("Tahun ajaran"));
  assert.equal(table.rows[0]?.[1], "2026/2027");
  assert.equal(table.rows[0]?.[2], "Genap");
  assert.match(String(table.rows[0]?.at(-1)), /Evaluasi/);
});
