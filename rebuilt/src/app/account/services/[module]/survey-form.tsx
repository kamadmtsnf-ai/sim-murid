"use client";
import {
  formatAcademicYear,
  semesterLabel,
  semesterPeriod,
  academicPeriodForDate,
} from "@/lib/academic/period";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField, controlClass } from "@/components/domain-controls";
import { commands, type ServiceSnapshot } from "@/lib/services/validation";
import { surveyResponse } from "@/lib/services/surveys";
import { SurveyEditor } from "./survey-editor";
type Row = Record<string, unknown>;
const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
const list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
type Mutate = (c: unknown) => Promise<boolean>;
export function SurveyForm({
  data,
  userId,
  busy,
  mutate,
  blocked = false,
}: {
  data: ServiceSnapshot;
  userId: string;
  busy: boolean;
  mutate: Mutate;
  blocked?: boolean;
}) {
  const [active, setActive] = useState<string>("");
  const [activeDirty, setActiveDirty] = useState(false),
    [kind, setKind] = useState("main");
  function maySwitch() {
    return (
      !activeDirty ||
      window.confirm(
        "Jawaban belum tersinkron. Tetap berpindah dari survei ini?",
      )
    );
  }
  const [periodYear, setPeriodYear] = useState(
    String(
      data.years?.find((y) => y.is_active)?.id ?? data.years?.[0]?.id ?? "",
    ),
  );
  const [periodSemester, setPeriodSemester] = useState(
    academicPeriodForDate(data.today)?.semester ?? 1,
  );
  const [dateError, setDateError] = useState("");
  const selectedYear = data.years?.find((y) => y.id === periodYear),
    periodBounds = semesterPeriod(selectedYear?.start_year, periodSemester);
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? ""),
      kind = get("kind");
    if (
      !periodBounds ||
      get("start") < periodBounds.start ||
      get("end") > periodBounds.end ||
      get("end") < get("start")
    ) {
      setDateError(
        "Tanggal survei harus berada dalam semester dan tahun ajaran yang dipilih.",
      );
      return;
    }
    setDateError("");
    const command = {
      type: "period",
      periodId: null,
      title: get("title"),
      yearId: get("yearId"),
      semester: Number(get("semester")),
      start: get("start"),
      end: get("end"),
      targets: f.getAll("targets"),
      kind,
      questions:
        kind === "micro"
          ? get("questions")
              .split("\n")
              .filter((x) => x.trim())
              .map((x, i) => ({
                code: "M-" + (i + 1),
                kind: "essay",
                question: x.trim(),
                required: true,
                section: "micro",
                aspect: "micro",
              }))
          : null,
      examOverride: get("examOverride"),
    };
    const valid = commands.surveys.safeParse(command);
    if (!valid.success) {
      setDateError(
        "Periksa judul (minimal 3 karakter), target, serta pertanyaan mikro (1–50 pertanyaan, masing-masing 3–1000 karakter).",
      );
      return;
    }
    void mutate(valid.data);
  }
  return (
    <div className="survey-form space-y-6">
      {Array.isArray(data.extra.required) && data.extra.required.length > 0 && (
        <p role="alert" className="rounded border p-3">
          Ada survei wajib yang perlu diselesaikan. Jawaban dapat disimpan
          sebagai draft.
        </p>
      )}
      {data.isManager && (
        <details className="rounded border p-4">
          <summary>Buat periode survei utama / mikro</summary>
          {!data.years?.length && (
            <p role="status" className="text-sm">
              Tahun ajaran belum tersedia. Siapkan tahun ajaran terlebih dahulu.
            </p>
          )}
          <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-2">
            <fieldset disabled={busy || blocked} className="contents">
              <TextField name="title" label="Judul" required max={2000} />
              <label className="block text-sm">
                Tahun ajaran
                <select
                  className={controlClass}
                  name="yearId"
                  required
                  value={periodYear}
                  onChange={(e) => {
                    setPeriodYear(e.target.value);
                    setDateError("");
                  }}
                >
                  {(data.years ?? []).map((y) => (
                    <option key={String(y.id)} value={String(y.id)}>
                      {formatAcademicYear(y.start_year)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Semester
                <select
                  className={controlClass}
                  name="semester"
                  value={periodSemester}
                  onChange={(e) => {
                    setPeriodSemester(Number(e.target.value));
                    setDateError("");
                  }}
                >
                  <option value="1">Ganjil (Juli–Desember)</option>
                  <option value="2">Genap (Januari–Juni)</option>
                </select>
              </label>
              <label className="block text-sm">
                Jenis
                <select
                  className={controlClass}
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="main">Survei utama</option>
                  <option value="micro">Survei mikro</option>
                </select>
              </label>
              {periodBounds && (
                <p className="text-sm text-muted-foreground">
                  {formatAcademicYear(selectedYear?.start_year)} ·{" "}
                  {periodBounds.label}
                </p>
              )}
              {dateError && <p role="alert">{dateError}</p>}
              <div key={`${periodYear}-${periodSemester}`} className="contents">
                <label className="block text-sm">
                  Mulai
                  <input
                    className={controlClass}
                    type="date"
                    name="start"
                    min={periodBounds?.start}
                    max={periodBounds?.end}
                    required
                  />
                </label>
                <label className="block text-sm">
                  Selesai
                  <input
                    className={controlClass}
                    type="date"
                    name="end"
                    min={periodBounds?.start}
                    max={periodBounds?.end}
                    required
                  />
                </label>
              </div>
              <fieldset>
                <legend>Target</legend>
                {[
                  ["student", "Siswa"],
                  ["teacher", "Guru"],
                  ["parent", "Orangtua"],
                ].map(([k, v]) => (
                  <label key={k} className="mr-3">
                    <input type="checkbox" name="targets" value={k} /> {v}
                  </label>
                ))}
              </fieldset>
              <TextField
                label="Alasan override dekat ujian (bila diperlukan)"
                name="examOverride"
              />
              {kind === "micro" && (
                <label>
                  Pertanyaan mikro (satu esai wajib per baris)
                  <textarea
                    className={controlClass}
                    name="questions"
                    maxLength={50050}
                    required
                  />
                </label>
              )}
              <Button disabled={busy || blocked || !periodYear}>
                Buat periode
              </Button>
            </fieldset>
          </form>
        </details>
      )}
      {!data.rows.length && (
        <section className="rounded-xl border border-dashed bg-card p-6">
          <h2 className="text-lg font-semibold">
            Belum ada survei untuk akun Anda
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Survei ditampilkan sesuai target peran dan periode yang ditetapkan.
          </p>
        </section>
      )}
      {data.rows.map((p) => {
        const r = obj(p.response),
          parsed = surveyResponse.safeParse(p.response),
          available =
            p.status === "open" &&
            String(p.starts_on) <= data.today &&
            String(p.ends_on) >= data.today;
        async function open() {
          if (!maySwitch()) return;
          if (active === String(p.id)) {
            setActive("");
            setActiveDirty(false);
            return;
          }
          if (parsed.success) {
            setActive(String(p.id));
            setActiveDirty(false);
            return;
          }
          const ok = await mutate({ type: "start", periodId: p.id });
          if (ok) {
            setActive(String(p.id));
            setActiveDirty(false);
          }
        }
        return (
          <article
            className="space-y-3 rounded-xl border bg-card p-5 shadow-sm"
            key={String(p.id)}
          >
            <h2 className="text-xl font-semibold">{String(p.title)}</h2>
            <p className="text-sm text-muted-foreground">
              Tahun ajaran{" "}
              {formatAcademicYear(
                data.years?.find((y) => y.id === p.academic_year_id)
                  ?.start_year,
              )}{" "}
              · Semester {semesterLabel(p.semester)}
            </p>
            <p>
              {String(p.starts_on)} s.d. {String(p.ends_on)} |{" "}
              {p.kind === "micro" ? "Survei mikro" : "Survei utama"} ·{" "}
              {p.status === "closed"
                ? "Ditutup"
                : available
                  ? "Sedang berlangsung"
                  : "Di luar jadwal"}{" "}
              · {r.submitted_at ? "Terkirim" : "Belum final"}
            </p>
            {((available &&
              (!data.isManager ||
                (Array.isArray(p.targets) &&
                  p.targets.includes(data.extra.respondentRole)))) ||
              parsed.success) && (
              <Button
                type="button"
                aria-expanded={active === p.id}
                disabled={busy || (!parsed.success && blocked)}
                onClick={() => void open()}
              >
                {active === p.id
                  ? "Tutup jawaban"
                  : r.submitted_at || !available
                    ? "Lihat jawaban"
                    : "Buka / lanjutkan jawaban"}
              </Button>
            )}
            {data.isManager && p.status === "open" && (
              <Button
                variant="outline"
                disabled={busy || blocked}
                onClick={() => {
                  if (!maySwitch()) return;
                  if (
                    window.confirm("Tutup periode? Jawaban baru akan ditolak.")
                  )
                    void mutate({ type: "close", periodId: p.id });
                }}
              >
                Tutup periode
              </Button>
            )}
            {active === p.id && parsed.success && (
              <SurveyEditor
                period={{ ...p, status: available ? p.status : "closed" }}
                key={String(p.id)}
                response={parsed.data}
                userId={userId}
                busy={busy}
                blocked={blocked}
                onDirty={setActiveDirty}
                mutate={mutate}
                peers={list(data.extra.peers)}
              />
            )}{" "}
            {Array.isArray(p.plan) && (
              <details>
                <summary>Rencana tindak lanjut</summary>
                {p.plan.map((x, i) => (
                  <p key={i}>
                    {String(obj(x).description)} — {String(obj(x).owner)} —{" "}
                    {String(obj(x).status)}
                  </p>
                ))}
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
