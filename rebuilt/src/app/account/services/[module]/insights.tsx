"use client";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { formatAcademicYear, semesterLabel } from "@/lib/academic/period";
import { TableRegion } from "@/components/ui/data-table";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  TextField,
  SelectField,
  controlClass,
} from "@/components/domain-controls";
import { analysisSchema } from "@/lib/services/analysis-schema";
import type { ServiceSnapshot } from "@/lib/services/validation";
type Row = Record<string, unknown>;
const list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []),
  obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
export function InsightsPanel({
  data,
  busy,
  mutate,
  load,
}: {
  data: ServiceSnapshot;
  busy: boolean;
  mutate: (c: unknown) => Promise<boolean>;
  load: (periodId: string, role?: string, quality?: string) => Promise<void>;
}) {
  const applied = obj(data.extra.appliedFilters);
  const [period, setPeriod] = useState(String(applied.periodId ?? "")),
    [message, setMessage] = useState(""),
    [points, setPoints] = useState(Math.max(3, list(data.extra.plan).length)),
    [aiBusy, setAiBusy] = useState(false),
    [page, setPage] = useState(1),
    [role, setRole] = useState(String(applied.role ?? "")),
    [quality, setQuality] = useState(String(applied.quality ?? ""));
  const aiLock = useRef(false),
    dirty = useRef(false),
    dirtyForms = useRef(new Set<HTMLFormElement>());
  useWriteGuard(
    () => aiLock.current,
    () => dirty.current,
  );
  async function save(command: unknown, form: HTMLFormElement) {
    const ok = await mutate(command);
    if (ok) {
      dirtyForms.current.delete(form);
      dirty.current = dirtyForms.current.size > 0;
    }
    return ok;
  }
  const scopeReady =
    period === String(applied.periodId ?? "") &&
    role === String(applied.role ?? "") &&
    quality === String(applied.quality ?? "");
  const disabled = busy || aiBusy || !scopeReady;
  const selected = data.rows.find((p) => p.id === period);
  const end = typeof selected?.end === "string" ? selected.end : "";
  const planUntil = end
    ? new Date(Date.parse(end + "T00:00:00Z") + 30 * 86400000)
        .toISOString()
        .slice(0, 10)
    : "";
  const canEditPlan =
    selected?.status === "closed" &&
    data.today > end &&
    data.today <= planUntil;
  async function ai(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (aiLock.current || busy) return;
    aiLock.current = true;
    setAiBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form),
      body = Object.fromEntries(f);
    try {
      const r = await fetch("/api/services/ai", {
          signal: AbortSignal.timeout(55000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            ...(body.action === "configure" ? {} : { periodId: period }),
          }),
        }),
        b = await r.json();
      setMessage(String(b.message));
      if (r.ok) {
        if (body.action === "configure") {
          form.reset();
          dirtyForms.current.delete(form);
          dirty.current = dirtyForms.current.size > 0;
        }
        await load(period, role, quality);
      }
    } catch {
      setMessage(
        "Penyedia belum tersedia. Muat ulang hasil sebelum mencoba lagi.",
      );
    } finally {
      aiLock.current = false;
      setAiBusy(false);
    }
  }
  function plan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (disabled || !period) return;
    void save(
      {
        type: "plan",
        periodId: period,
        items: Array.from({ length: points }, (_, i) =>
          Object.fromEntries(
            ["description", "owner", "target", "aspect", "status"].map((k) => [
              k,
              String(f.get(k + i) ?? ""),
            ]),
          ),
        ),
      },
      e.currentTarget,
    );
  }
  return (
    <section
      className="min-w-0 space-y-6 wrap-anywhere"
      aria-busy={busy || aiBusy}
    >
      <p role="status" aria-live="polite">
        {aiBusy ? "Analisis sedang diproses…" : message}
      </p>
      {!period && (
        <p className="rounded-lg border bg-muted/40 p-4">
          Pilih periode untuk melihat hasil survei sesuai hak akses Anda.
        </p>
      )}
      <label>
        Periode
        <select
          className={controlClass}
          value={period}
          disabled={busy || aiBusy}
          onChange={async (e) => {
            if (
              dirty.current &&
              !window.confirm(
                "Isian belum disimpan. Ganti periode dan abaikan isian?",
              )
            )
              return;
            dirty.current = false;
            dirtyForms.current.clear();
            setPage(1);
            setPeriod(e.target.value);
            setRole("");
            setQuality("");
            await load(e.target.value);
          }}
        >
          <option value="">Pilih periode</option>
          {data.rows.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {String(p.title)} ({String(p.kind)}) ·{" "}
              {formatAcademicYear(
                data.years?.find((y) => y.id === p.academic_year_id)
                  ?.start_year,
              )}{" "}
              · {semesterLabel(p.semester)}
            </option>
          ))}
        </select>
      </label>
      {period && scopeReady && (
        <div className="flex flex-wrap gap-3">
          {["csv", "xlsx", "pdf"].map((format) => (
            <a
              key={format}
              className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2"
              href={
                "/api/services/insights?" +
                new URLSearchParams({
                  periodId: period,
                  ...(role ? { role } : {}),
                  ...(quality ? { quality } : {}),
                  format,
                })
              }
            >
              Ekspor {format.toUpperCase()}
            </a>
          ))}
        </div>
      )}
      {data.extra.suppressed === true && (
        <p>
          Hasil personal disembunyikan sampai minimal{" "}
          {String(data.extra.minimum)} penilai substantif terpenuhi.
        </p>
      )}
      {data.extra.peer !== undefined && (
        <section>
          <h2 className="font-semibold">Hasil teman sejawat</h2>
          <p>Penilai substantif: {String(obj(data.extra.peer).count)}</p>
          {Object.entries(obj(obj(data.extra.peer).dimensions)).map(
            ([k, v]) => (
              <p key={k}>
                {k}: {String(v)}
              </p>
            ),
          )}
          {Array.isArray(obj(data.extra.peer).quotes) &&
            (obj(data.extra.peer).quotes as string[]).map((q, i) => (
              <blockquote className="border-l p-3" key={i}>
                {q}
              </blockquote>
            ))}
        </section>
      )}
      {data.isManager && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              dirty.current &&
              !window.confirm(
                "Isian belum disimpan. Terapkan filter dan abaikan isian?",
              )
            )
              return;
            dirty.current = false;
            dirtyForms.current.clear();
            setPage(1);
            await load(period, role, quality);
          }}
          className="flex min-w-0 flex-wrap items-end gap-3"
        >
          <label>
            Peran
            <select
              className={controlClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Semua</option>
              {["student", "teacher", "parent"].map((k) => (
                <option key={k} value={k}>
                  {{
                    student: "Siswa",
                    teacher: "Guru",
                    parent: "Orang tua",
                    belum: "Belum dimulai",
                    proses: "Dalam proses",
                    selesai: "Selesai",
                  }[k] ?? k}
                </option>
              ))}
            </select>
          </label>
          <label>
            Keandalan
            <select
              className={controlClass}
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="">Semua (termasuk flag)</option>
              {["tinggi", "sedang", "rendah"].map((k) => (
                <option key={k} value={k}>
                  {{
                    student: "Siswa",
                    teacher: "Guru",
                    parent: "Orang tua",
                    belum: "Belum dimulai",
                    proses: "Dalam proses",
                    selesai: "Selesai",
                  }[k] ?? k}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!period || busy || aiBusy}>
            Terapkan filter hasil
          </Button>
        </form>
      )}
      {data.isManager && (
        <>
          {!scopeReady && (
            <p role="status">Terapkan filter untuk memuat hasil yang sesuai.</p>
          )}
          <h2 className="text-lg font-semibold">Progres dan keandalan</h2>
          {period && scopeReady && list(data.extra.progress).length === 0 && (
            <p className="rounded-lg border p-4 text-muted-foreground">
              Belum ada responden sesuai filter.
            </p>
          )}
          <details className="rounded-lg border bg-card p-4">
            <summary className="min-h-11 cursor-pointer font-medium">
              Daftar responden (
              {scopeReady ? list(data.extra.progress).length : 0})
            </summary>
            <div className="grid min-w-0 gap-3 pt-3 lg:grid-cols-2">
              {(scopeReady
                ? list(data.extra.progress).slice((page - 1) * 20, page * 20)
                : []
              ).map((r) => (
                <article
                  key={
                    period +
                    ":" +
                    String(r.user_id) +
                    ":" +
                    String(r.note ?? "")
                  }
                  className="rounded border p-3"
                >
                  <p>
                    {String(r.name)} — {r.submitted_at ? "Terkirim" : "Draft"} —{" "}
                    {String(obj(r.flags).reliability ?? "belum final")}
                  </p>
                  <form
                    onInputCapture={(e) => {
                      dirtyForms.current.add(e.currentTarget);
                      dirty.current = true;
                    }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(
                        {
                          type: "note",
                          periodId: period,
                          userId: r.user_id,
                          note: String(
                            new FormData(e.currentTarget).get("note") ?? "",
                          ),
                        },
                        e.currentTarget,
                      );
                    }}
                    className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end"
                  >
                    <TextField
                      label="Catatan pemantau"
                      name="note"
                      value={String(r.note ?? "")}
                      max={2000}
                    />
                    <Button disabled={disabled}>Simpan catatan</Button>
                  </form>
                </article>
              ))}
              {scopeReady && list(data.extra.progress).length > 20 && (
                <nav
                  aria-label="Halaman responden"
                  className="flex flex-wrap items-center gap-3"
                >
                  <Button
                    variant="outline"
                    disabled={disabled || page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <span>
                    Halaman {page} /{" "}
                    {Math.ceil(list(data.extra.progress).length / 20)}
                  </span>
                  <Button
                    variant="outline"
                    disabled={
                      disabled || page * 20 >= list(data.extra.progress).length
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Berikutnya
                  </Button>
                </nav>
              )}
            </div>
          </details>
          <TableRegion label="Tabel data — gulir untuk melihat seluruh kolom">
            <table className="w-full text-left">
              <caption className="sr-only">
                Data sesuai filter dan hak akses Anda
              </caption>
              <thead>
                <tr>
                  {["Peran", "Aspek", "Kode", "Jumlah", "Rata-rata"].map(
                    (k) => (
                      <th scope="col" key={k}>
                        {k}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {(scopeReady ? list(data.extra.aggregates) : []).map((r, i) => (
                  <tr key={i}>
                    {["role", "aspect", "code", "n", "mean"].map((k) => (
                      <td className="border-b p-2" key={k}>
                        {String(r[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          <details>
            <summary>Tren lintas periode</summary>
            {(scopeReady ? list(data.extra.trend) : []).map((r, i) => (
              <p key={i}>
                {String(r.period_id)} / {String(r.role)} / {String(r.aspect)}:{" "}
                {String(r.mean)} (n={String(r.n)})
              </p>
            ))}
          </details>
          <details>
            <summary>Esai terotorisasi tanpa identitas responden</summary>
            {(scopeReady ? list(data.extra.essays) : []).map((r, i) => (
              <p className="border-b p-3" key={i}>
                {String(r.code)} — {String(r.text)}
              </p>
            ))}
          </details>
          {data.extra.canPlan === true &&
            (scopeReady ? list(data.extra.plan) : []).map((p, i) => (
              <form
                key={period + ":" + i + ":" + String(p.status)}
                onInputCapture={(e) => {
                  dirtyForms.current.add(e.currentTarget);
                  dirty.current = true;
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(
                    {
                      type: "plan_status",
                      periodId: period,
                      index: i,
                      status: String(
                        new FormData(e.currentTarget).get("status"),
                      ),
                    },
                    e.currentTarget,
                  );
                }}
                className="flex min-w-0 flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
              >
                <p>{String(p.description)}</p>
                <SelectField
                  label="Ketercapaian"
                  name="status"
                  value={String(p.status)}
                >
                  {["belum", "proses", "selesai"].map((k) => (
                    <option key={k} value={k}>
                      {{
                        student: "Siswa",
                        teacher: "Guru",
                        parent: "Orang tua",
                        belum: "Belum dimulai",
                        proses: "Dalam proses",
                        selesai: "Selesai",
                      }[k] ?? k}
                    </option>
                  ))}
                </SelectField>
                <Button disabled={disabled}>Perbarui status</Button>
              </form>
            ))}
          {data.extra.canPlan === true &&
            period &&
            scopeReady &&
            canEditPlan && (
              <form
                onInputCapture={(e) => {
                  dirtyForms.current.add(e.currentTarget);
                  dirty.current = true;
                }}
                key={period + ":" + JSON.stringify(data.extra.plan)}
                className="space-y-3 rounded-lg border p-4"
                onSubmit={plan}
              >
                <h2 className="font-semibold">Rencana aksi Kepala Madrasah</h2>
                <p>3–7 poin, setelah akhir tanggal penutupan sampai H+30.</p>
                <label>
                  Jumlah poin
                  <input
                    type="number"
                    min="3"
                    max="7"
                    value={points}
                    className={controlClass}
                    onChange={(e) => {
                      const next = Math.max(
                        3,
                        Math.min(7, Number(e.target.value) || 3),
                      );
                      if (
                        next < points &&
                        !window.confirm(
                          "Kurangi jumlah poin dan abaikan isian pada poin terakhir?",
                        )
                      )
                        return;
                      dirty.current = true;
                      setPoints(next);
                    }}
                  />
                </label>
                {Array.from({ length: points }, (_, i) => (
                  <fieldset
                    key={period + ":" + i}
                    className="grid gap-3 border p-3 sm:grid-cols-3"
                  >
                    <legend>Poin {i + 1}</legend>
                    <TextField
                      label="Deskripsi"
                      name={"description" + i}
                      value={String(
                        list(data.extra.plan)[i]?.description ?? "",
                      )}
                      required
                      max={2000}
                    />
                    <TextField
                      label="Penanggung jawab"
                      name={"owner" + i}
                      value={String(list(data.extra.plan)[i]?.owner ?? "")}
                      required
                    />
                    <TextField
                      label="Target waktu"
                      name={"target" + i}
                      value={String(list(data.extra.plan)[i]?.target ?? "")}
                      type="date"
                      required
                    />
                    <SelectField
                      label="Aspek"
                      name={"aspect" + i}
                      value={String(
                        list(data.extra.plan)[i]?.aspect ?? "Pengajaran",
                      )}
                    >
                      {[
                        "Pengajaran",
                        "Fasilitas",
                        "Kurikulum",
                        "Karakter",
                        "Disiplin",
                        "Budaya",
                      ].map((k) => (
                        <option key={k} value={k}>
                          {{
                            student: "Siswa",
                            teacher: "Guru",
                            parent: "Orang tua",
                            belum: "Belum dimulai",
                            proses: "Dalam proses",
                            selesai: "Selesai",
                          }[k] ?? k}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Ketercapaian"
                      name={"status" + i}
                      value={String(
                        list(data.extra.plan)[i]?.status ?? "belum",
                      )}
                    >
                      {["belum", "proses", "selesai"].map((k) => (
                        <option key={k} value={k}>
                          {{
                            student: "Siswa",
                            teacher: "Guru",
                            parent: "Orang tua",
                            belum: "Belum dimulai",
                            proses: "Dalam proses",
                            selesai: "Selesai",
                          }[k] ?? k}
                        </option>
                      ))}
                    </SelectField>
                  </fieldset>
                ))}
                <Button disabled={disabled}>Simpan rencana</Button>
              </form>
            )}
          {data.isAdmin && (
            <form
              onInputCapture={(e) => {
                if (
                  new FormData(e.currentTarget).get("action") === "configure"
                ) {
                  dirtyForms.current.add(e.currentTarget);
                  dirty.current = true;
                }
              }}
              onSubmit={ai}
              className="grid min-w-0 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <h2 className="font-semibold">Konfigurasi penyedia AI</h2>
              <input type="hidden" name="action" value="configure" />
              <SelectField label="Penyedia" name="provider">
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </SelectField>
              <TextField
                label="Model yang tersedia pada akun penyedia"
                name="model"
                required
              />
              <TextField
                label="API key baru (tidak ditampilkan ulang)"
                name="key"
                type="password"
                max={1000}
                required
              />
              <Button disabled={busy || aiBusy}>Simpan terenkripsi</Button>
            </form>
          )}
          <p>
            Status:{" "}
            {list(data.extra.configs)
              .map(
                (c) =>
                  String(c.provider) +
                  " / " +
                  String(c.model) +
                  " terkonfigurasi",
              )
              .join("; ") || "Belum dikonfigurasi"}
          </p>
          <p className="text-sm text-muted-foreground">
            Analisis AI mencakup esai seluruh periode; filter peran dan
            keandalan hanya berlaku pada hasil terfilter. Jangan sertakan
            informasi pribadi dalam esai.
          </p>
          <form
            onInputCapture={(e) => {
              if (new FormData(e.currentTarget).get("action") === "configure") {
                dirtyForms.current.add(e.currentTarget);
                dirty.current = true;
              }
            }}
            onSubmit={ai}
            className="flex min-w-0 flex-wrap items-end gap-3"
          >
            <SelectField name="action" label="Tindakan">
              <option value="analyze">Analisis esai</option>
              <option value="invalidate">
                Hapus cache selesai untuk ulang
              </option>
            </SelectField>
            <SelectField label="Penyedia" name="provider">
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </SelectField>
            <Button disabled={disabled || !period}>Jalankan</Button>
          </form>
          {(scopeReady ? list(data.extra.analyses) : []).map((r) => (
            <article
              key={String(r.id)}
              className="min-w-0 space-y-3 rounded-lg border bg-card p-4"
            >
              <h3>
                {String(r.model)} — {String(r.status)}
              </h3>
              {analysisSchema.safeParse(r.result).success ? (
                <AnalysisResult value={r.result} />
              ) : r.status === "succeeded" ? (
                <p>
                  Format hasil belum dapat ditampilkan. Muat ulang atau hubungi
                  admin.
                </p>
              ) : null}
              {typeof r.error_code === "string" && (
                <p>Analisis gagal: {String(r.error_code)}</p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}

function AnalysisResult({ value }: { value: unknown }) {
  const parsed = analysisSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  return (
    <div className="space-y-4">
      <p>{result.ringkasan_umum}</p>
      <p className="text-sm font-medium">
        Sentimen:{" "}
        {
          {
            positif: "Positif",
            campuran: "Campuran",
            perlu_perhatian: "Perlu perhatian",
          }[result.skor_sentimen_keseluruhan]
        }
      </p>
      {(
        [
          ["Tema positif", result.tema_positif],
          ["Perlu perhatian", result.tema_perlu_perhatian],
          ["Rekomendasi tindakan", result.rekomendasi_tindakan],
        ] as const
      ).map(([title, items]) => (
        <section key={title}>
          <h4 className="font-medium">{title}</h4>
          {items.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada butir.</p>
          )}
        </section>
      ))}
      {result.kutipan_representatif.map((q, i) => (
        <blockquote key={i} className="border-l-2 pl-4">
          {q.teks}
          <span className="block text-sm text-muted-foreground">
            {q.sentimen}
          </span>
        </blockquote>
      ))}
    </div>
  );
}
