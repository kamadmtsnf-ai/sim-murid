"use client";
import {
  formatAcademicYear,
  semesterLabel,
  semesterPeriod,
  academicPeriodForDate,
} from "@/lib/academic/period";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  TextField,
  SelectField,
  controlClass,
} from "@/components/domain-controls";
import {
  requiredMissing,
  type ServiceSnapshot,
} from "@/lib/services/validation";
import extras from "@/lib/services/instrument-extras.json";
type Row = Record<string, unknown>;
const obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {}),
  list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
type Answers = Record<string, string | number>;
type Mutate = (c: unknown) => Promise<boolean>;
function SurveyEditor({
  period,
  response,
  userId,
  busy,
  mutate,
  peers,
}: {
  period: Row;
  response: Row;
  userId: string;
  busy: boolean;
  mutate: Mutate;
  peers: Row[];
}) {
  const [answers, setAnswers] = useState<Answers>(
      obj(response.answers) as Answers,
    ),
    [peerAnswers, setPeerAnswers] = useState<Record<string, Answers>>(
      obj(response.peer_answers) as Record<string, Answers>,
    ),
    [status, setStatus] = useState(""),
    [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    latest = useRef({ response, answers, mutate });
  useEffect(() => {
    latest.current = { response, answers, mutate };
  }, [response, answers, mutate]);
  const key =
      "sim-survey:" +
      userId +
      ":" +
      String(period.id) +
      ":" +
      String(period.instrument_version),
    locked = !!response.submitted_at || period.status === "closed";
  useEffect(() => {
    const recover = async () => {
      try {
        for (const k of Object.keys(localStorage))
          if (
            k.startsWith("sim-survey:") &&
            !k.startsWith("sim-survey:" + userId + ":")
          )
            localStorage.removeItem(k);
        const raw = localStorage.getItem(key);
        if (raw && !locked) {
          const saved = JSON.parse(raw);
          if (saved.version === response.revision) {
            setAnswers(saved.answers);
            setDirty(true);
            setStatus("Draft lokal dipulihkan; sinkronkan saat terhubung.");
          } else
            setStatus(
              "Draft lokal berasal dari versi lama. Jawaban server dipertahankan.",
            );
        }
        if (locked) localStorage.removeItem(key);
      } catch {
        setStatus("Penyimpanan lokal tidak tersedia. Simpan ke server.");
      }
    };
    void recover();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, locked, response.revision, userId]);
  async function save(final = false) {
    if (locked) return;
    const s = latest.current;
    if (final) {
      const missing = requiredMissing(list(s.response.instrument), s.answers);
      if (missing.length) {
        setStatus("Pertanyaan wajib belum lengkap: " + missing.join(", "));
        return;
      }
    }
    if (
      final &&
      !window.confirm("Kirim jawaban final? Setelah dikirim jawaban terkunci.")
    )
      return;
    const ok = await s.mutate({
      type: final ? "submit" : "save",
      periodId: period.id,
      version: s.response.revision,
      answers: s.answers,
    });
    if (ok) {
      setDirty(false);
      localStorage.removeItem(key);
      setStatus(final ? "Jawaban dikirim." : "Tersimpan di server.");
    } else
      setStatus(
        "Belum tersimpan. Periksa koneksi atau konflik versi; muat ulang untuk data terbaru.",
      );
  }
  function change(code: string, value: string | number) {
    const next = { ...answers, [code]: value };
    setAnswers(next);
    setDirty(true);
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: response.revision, answers: next }),
      );
    } catch {}
    setStatus(
      navigator.onLine
        ? "Menunggu sinkronisasi…"
        : "Offline — draft tersimpan pada perangkat ini.",
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (navigator.onLine) void save();
    }, 2000);
  }
  useEffect(() => {
    const online = () => {
      if (dirty) void save();
    };
    window.addEventListener("online", online);
    const logout = (e: Event) => {
      const form = e.target;
      if (
        form instanceof HTMLFormElement &&
        form.action.endsWith("/api/auth/logout")
      )
        for (const k of Object.keys(localStorage))
          if (k.startsWith("sim-survey:")) localStorage.removeItem(k);
    };
    document.addEventListener("submit", logout, true);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("submit", logout, true);
    };
  });
  return (
    <section className="space-y-4">
      <p role="status" aria-live="polite">
        {status} {locked ? "Jawaban terkunci." : ""}
      </p>
      <p>
        Isi seluruh pertanyaan wajib. Skala1–5; esai wajib sesuai instrumen.
        Jawaban kosong tidak dianggap0.
      </p>
      {list(response.instrument).map((q) => (
        <label key={String(q.code)} className="block rounded border p-3">
          <span className="block">
            {String(q.question)} {q.required ? "*" : ""}
          </span>
          {q.kind === "essay" ? (
            <textarea
              className={controlClass}
              value={String(answers[String(q.code)] ?? "")}
              onChange={(e) => change(String(q.code), e.target.value)}
              maxLength={10000}
              disabled={locked}
              required={q.required === true}
            />
          ) : (
            <select
              className={controlClass}
              disabled={locked}
              value={String(answers[String(q.code)] ?? "")}
              onChange={(e) => {
                if (e.target.value)
                  change(String(q.code), Number(e.target.value));
              }}
            >
              <option value="">Pilih jawaban</option>
              {[
                "Sangat Tidak Setuju",
                "Tidak Setuju",
                "Netral",
                "Setuju",
                "Sangat Setuju",
              ].map((t, i) => (
                <option value={i + 1} key={t}>
                  {i + 1} — {t}
                </option>
              ))}
            </select>
          )}
        </label>
      ))}
      {response.role === "teacher" &&
        Array.isArray(response.peers) &&
        response.peers.length > 0 && (
          <fieldset className="space-y-4 rounded border p-4">
            <legend>Penilaian teman sejawat</legend>
            <p>
              Skor1–5 atau TT. Esai PTS-7 opsional. Identitas penilai tidak
              ditampilkan pada laporan personal.
            </p>
            {response.peers.map((id) => (
              <section key={String(id)} className="space-y-2 border-b py-3">
                <h3 className="font-semibold">
                  {String(peers.find((p) => p.id === id)?.name ?? "Rekan guru")}
                </h3>
                {extras.peer.map((d) => (
                  <label key={d.kode} className="block">
                    {d.dimensi}: {d.pertanyaan}
                    <select
                      className={controlClass}
                      disabled={locked || !!response.peer_submitted_at}
                      value={String(peerAnswers[String(id)]?.[d.kode] ?? "")}
                      onChange={(e) =>
                        setPeerAnswers((v) => ({
                          ...v,
                          [String(id)]: {
                            ...v[String(id)],
                            [d.kode]:
                              e.target.value === "TT"
                                ? "TT"
                                : Number(e.target.value),
                          },
                        }))
                      }
                    >
                      <option value="">Pilih</option>
                      {[1, 2, 3, 4, 5, "TT"].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <textarea
                  className={controlClass}
                  aria-label="Apresiasi opsional"
                  placeholder="Apresiasi atau masukan (opsional)"
                  maxLength={10000}
                  disabled={locked || !!response.peer_submitted_at}
                  value={String(peerAnswers[String(id)]?.["PTS-7"] ?? "")}
                  onChange={(e) =>
                    setPeerAnswers((v) => ({
                      ...v,
                      [String(id)]: {
                        ...v[String(id)],
                        "PTS-7": e.target.value,
                      },
                    }))
                  }
                />
              </section>
            ))}
            {!response.peer_submitted_at && (
              <div className="flex gap-3">
                <Button
                  disabled={busy || locked}
                  onClick={() =>
                    void mutate({
                      type: "peer_save",
                      periodId: period.id,
                      version: response.revision,
                      answers: peerAnswers,
                    })
                  }
                >
                  Simpan draft rekan
                </Button>
                <Button
                  disabled={busy || locked}
                  onClick={() => {
                    if (window.confirm("Kirim penilaian rekan final?"))
                      void mutate({
                        type: "peer_submit",
                        periodId: period.id,
                        version: response.revision,
                        answers: peerAnswers,
                      });
                  }}
                >
                  Kirim penilaian rekan
                </Button>
              </div>
            )}
          </fieldset>
        )}
      {!locked && (
        <div className="sticky bottom-0 flex gap-3 border-t bg-background p-3">
          <Button disabled={busy} onClick={() => void save()}>
            Simpan sekarang
          </Button>
          <Button disabled={busy} onClick={() => void save(true)}>
            Kirim final
          </Button>
        </div>
      )}
    </section>
  );
}
export function SurveyForm({
  data,
  userId,
  busy,
  mutate,
}: {
  data: ServiceSnapshot;
  userId: string;
  busy: boolean;
  mutate: Mutate;
}) {
  const [active, setActive] = useState<string>("");
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
    void mutate({
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
    });
  }
  return (
    <div className="space-y-6">
      {Array.isArray(data.extra.required) && data.extra.required.length > 0 && (
        <p role="alert" className="rounded border p-3">
          Ada survei wajib yang perlu diselesaikan. Jawaban dapat disimpan
          sebagai draft.
        </p>
      )}
      {data.isManager && (
        <details className="rounded border p-4">
          <summary>Buat periode survei utama / mikro</summary>
          <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField name="title" label="Judul" required />
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
            <SelectField label="Jenis" name="kind">
              <option value="main">Survei utama</option>
              <option value="micro">Survei mikro</option>
            </SelectField>
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
            <label>
              Pertanyaan mikro (satu esai wajib per baris)
              <textarea
                className={controlClass}
                name="questions"
                maxLength={20000}
              />
            </label>
            <Button disabled={busy}>Buat periode</Button>
          </form>
        </details>
      )}
      {data.rows.map((p) => {
        const r = obj(p.response);
        return (
          <article className="space-y-3 rounded border p-4" key={String(p.id)}>
            <h2 className="text-xl font-semibold">
              {String(p.title)} — {String(p.kind)}
            </h2>
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
              {String(p.status)} | {r.submitted_at ? "Terkirim" : "Belum final"}
            </p>
            {p.status === "open" && (
              <Button
                disabled={busy}
                onClick={async () => {
                  const ok = await mutate({ type: "start", periodId: p.id });
                  if (ok) setActive(String(p.id));
                }}
              >
                Buka / lanjutkan jawaban
              </Button>
            )}
            {data.isManager && p.status === "open" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm("Tutup periode? Jawaban baru akan ditolak.")
                  )
                    void mutate({ type: "close", periodId: p.id });
                }}
              >
                Tutup periode
              </Button>
            )}
            {active === p.id && typeof r.period_id === "string" && (
              <SurveyEditor
                period={p}
                response={r}
                userId={userId}
                busy={busy}
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
