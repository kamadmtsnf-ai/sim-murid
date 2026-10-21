"use client";
import {TableRegion} from "@/components/ui/data-table";

import {ModuleNavigation} from "@/components/module-navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  TextField,
  SelectField,
  controlClass,
} from "@/components/domain-controls";
import { createClient } from "@/lib/supabase/client";
import {
  diplomaFields,
  learningSnapshot,
  titles,
  type LearningSnapshot,
} from "@/lib/learning/validation";
import { BookReader } from "./reader";
type Row = Record<string, unknown>;
const text = (v: Row, k: string) => String(v[k] ?? ""),
  list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []),
  obj = (v: unknown): Row =>
    typeof v === "object" && v !== null ? (v as Row) : {};
export function LearningPanel({ initial }: { initial: LearningSnapshot }) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({
      semester: String(initial.semester),
    }),
    [edit, setEdit] = useState<Row | null>(null),
    [tab, setTab] = useState("main"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [book, setBook] = useState<Row | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [reportKind, setReportKind] = useState("combined"),
    [historyKind, setHistoryKind] = useState(""),
    [phFilter, setPhFilter] = useState("");
  const lock = useRef(false),
    domain = data.module,
    api = "/api/learning/" + domain;
  const people = [
      ...new Map(data.people.map((p) => [text(p, "id"), p])).values(),
    ],
    students = people.filter((p) =>
      ["student", "alumni"].includes(text(p, "role_code")),
    ),
    alumni = data.rows.filter((r) => r.role === "alumni");
  const classRow = data.classes.find((c) => c.id === filters.classId),
    gradeDate =
      filters.semester === "2"
        ? String(Number(classRow?.year ?? data.today.slice(0, 4)) + 1) +
          "-02-01"
        : String(classRow?.year ?? data.today.slice(0, 4)) + "-09-01";
  async function load(f = filters) {
    const r = await fetch(api + "?" + new URLSearchParams(f), {
        cache: "no-store",
      }),
      b = await r.json();
    if (!r.ok) throw new Error(String(b.message));
    setData(learningSnapshot.parse(b.data));
  }
  async function mutate(command: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("Menyimpan…");
    try {
      const r = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            revision: data.revision,
            command,
          }),
        }),
        body = await r.json();
      setMessage(String(body.message));
      if (r.ok) {
        setEdit(null);
        setSelected([]);
        await load();
      }
    } catch {
      setMessage(
        "Koneksi terputus. Muat ulang untuk memastikan hasil sebelum mencoba kembali.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function filter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget),
      next = Object.fromEntries(
        [...f.entries()]
          .filter(([, v]) => String(v))
          .map(([k, v]) => [k, String(v)]),
      );
    setBusy(true);
    try {
      await load(next);
      setFilters(next);
      setEdit(null);
      setSelected([]);
    } catch {
      setMessage("Data belum tersedia atau akses tidak diizinkan.");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? ""),
      reason = get("reason");
    let c: unknown;
    if (domain === "grades") {
      if (tab === "kkm")
        c = {
          type: "kkm",
          classId: filters.classId,
          subjectId: filters.subjectId,
          date: get("date"),
          value: Number(get("value")),
        };
      else
        c = {
          type: "batch",
          id: edit?.id ?? null,
          classId: filters.classId,
          subjectId: filters.subjectId,
          date: get("date"),
          kind: get("kind"),
          items: students.map((s) => ({
            studentId: s.id,
            value:
              get("value-" + s.id) === "" ? null : Number(get("value-" + s.id)),
            notes: get("notes-" + s.id),
          })),
          ...(edit ? { reason } : {}),
        };
    } else if (domain === "reports")
      c = {
        type: "publish",
        classId: filters.classId,
        semester: Number(filters.semester),
        studentIds: selected.length
          ? selected
          : data.rows.map((r) => r.student_id),
      };
    else if (domain === "promotions") {
      if (tab === "metadata")
        c = {
          type: "diploma",
          studentId: get("studentId"),
          metadata: Object.fromEntries(diplomaFields.map((k) => [k, get(k)])),
        };
      else if (tab === "access")
        c =
          get("scope") === "global"
            ? {
                type: "access",
                scope: "global",
                view: f.has("viewGlobal"),
                download: f.has("downloadGlobal"),
              }
            : {
                type: "access",
                scope: "individual",
                studentIds: f.getAll("studentIds"),
                view: get("view"),
                download: get("download"),
              };
      else
        c = {
          type: get("type"),
          sourceYearId: get("sourceYearId"),
          targetYearId: get("targetYearId"),
          items: data.rows
            .filter((r) => f.has("include-" + r.student_id))
            .map((r) => ({
              studentId: r.student_id,
              expectedClassId: r.class_id ?? null,
              classId: get("class-" + r.student_id) || null,
            })),
          reason,
        };
    } else
      c = {
        type: "book",
        id: edit?.id ?? null,
        title: get("title"),
        author: get("author"),
        publisher: get("publisher"),
        year: get("year") ? Number(get("year")) : null,
        version: get("version"),
        category: get("category"),
        subjectId: get("subjectId") || null,
        level: get("level") ? Number(get("level")) : null,
        url: get("url"),
        premium: f.has("premium"),
      };
    void mutate(c);
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const form = e.currentTarget,
      f = new FormData(form),
      file = f.get("file");
    if (!(file instanceof File) || !file.size) return;
    lock.current = true;
    setBusy(true);
    setMessage("Mengunggah dan memvalidasi berkas…");
    try {
      const r = await fetch("/api/learning/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare",
            kind: domain === "books" ? "book" : "diploma",
            targetId: String(f.get("targetId")),
            slot: domain === "books" ? undefined : String(f.get("slot")),
            filename: file.name,
            mime: file.type,
            size: file.size,
          }),
        }),
        b = await r.json();
      if (!r.ok) throw new Error(String(b.message));
      const client = createClient(),
        stored = await client.storage
          .from("learning-private")
          .uploadToSignedUrl(b.upload.path, b.upload.token, file, {
            contentType: file.type,
          });
      if (stored.error) throw new Error("Unggahan tidak berhasil.");
      const result = await fetch("/api/learning/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finalize", id: b.id }),
        }),
        body = await result.json();
      setMessage(String(body.message));
      if (result.ok) {
        form.reset();
        await load();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unggahan belum berhasil.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const subjectOptions = list(data.extra.subjects).map((s) => (
      <option key={text(s, "id")} value={text(s, "id")}>
        {text(s, "name")}
      </option>
    )),
    years = list(data.extra.years);
  const selectedUrl =
    api +
    "?" +
    new URLSearchParams({
      ...filters,
      kind: reportKind,
      format: "pdf",
      ...(selected.length ? { selected: selected.join(",") } : {}),
    });
  return (
    <div className="space-y-6" aria-busy={busy}>
      <ModuleNavigation base="/account/learning/" titles={titles} label="Akademik dan buku"/>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <form
        onSubmit={filter}
        className="grid gap-3 rounded border p-4 sm:grid-cols-3"
      >
        {domain !== "books" && (
          <>
            <SelectField
              name="classId"
              label="Kelas / tahun"
              value={filters.classId}
            >
              <option value="">Pilih kelas</option>
              {data.classes.map((c) => (
                <option key={text(c, "id")} value={text(c, "id")}>
                  {text(c, "name")} — {text(c, "year")}
                </option>
              ))}
            </SelectField>
            {domain !== "promotions" && (
              <SelectField
                label="Semester"
                name="semester"
                value={filters.semester ?? "1"}
              >
                <option value="1">1 (Juli–Desember)</option>
                <option value="2">2 (Januari–Juni)</option>
              </SelectField>
            )}
            <SelectField
              label="Siswa"
              name="studentId"
              value={filters.studentId}
            >
              <option value="">Semua sesuai izin</option>
              {people.map((p) => (
                <option value={text(p, "id")} key={text(p, "id")}>
                  {text(p, "full_name")}
                </option>
              ))}
            </SelectField>
          </>
        )}
        {(domain === "grades" || domain === "books") && (
          <SelectField
            label="Mata pelajaran"
            name="subjectId"
            value={filters.subjectId}
          >
            <option value="">Pilih mapel</option>
            {subjectOptions}
          </SelectField>
        )}
        {domain === "books" && (
          <>
            <TextField label="Cari judul / penulis" name="query" />
            <TextField label="Kategori" name="category" />
            <SelectField label="Tingkat" name="level">
              <option value="">Semua</option>
              {[7, 8, 9].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </SelectField>
          </>
        )}
        <Button disabled={busy}>Tampilkan</Button>
      </form>
      {domain === "grades" && (
        <>
          <p className="text-sm">
            Nilai 0 sah; kosong berarti belum diisi. Nomor PH tidak dipakai
            ulang setelah pembatalan. KKM baru tidak mengubah snapshot nilai
            lama.
          </p>
          {data.canWrite && filters.classId && filters.subjectId && (
            <section className="space-y-3 rounded border p-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={tab === "main" ? "default" : "outline"}
                  onClick={() => setTab("main")}
                >
                  Input nilai
                </Button>
                <Button
                  type="button"
                  variant={tab === "kkm" ? "default" : "outline"}
                  onClick={() => setTab("kkm")}
                >
                  KKM
                </Button>
              </div>
              <form
                key={tab + "-" + String(edit?.id ?? "new")}
                onSubmit={submit}
                className="space-y-3"
              >
                <TextField
                  label="Tanggal penilaian / periode KKM"
                  name="date"
                  type="date"
                  value={text(edit ?? {}, "assessment_date") || gradeDate}
                  required
                />
                {tab === "kkm" ? (
                  <TextField
                    label="KKM (0–100)"
                    name="value"
                    type="number"
                    value={String(data.extra.kkm ?? 75)}
                    required
                  />
                ) : (
                  <>
                    <SelectField
                      label="Jenis penilaian"
                      name="kind"
                      value={text(edit ?? {}, "kind") || "PH"}
                    >
                      {["PH", "ATS", "ASAS", "Praktik"].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </SelectField>
                    <div className="max-h-96 overflow-auto">
                      {students.map((p) => {
                        const sc = list(edit?.scores).find(
                          (s) => s.student_id === p.id,
                        );
                        return (
                          <div
                            key={text(p, "id")}
                            className="grid gap-2 border-b p-2 sm:grid-cols-3"
                          >
                            <span>{text(p, "full_name")}</span>
                            <input
                              className={controlClass}
                              aria-label={"Nilai " + text(p, "full_name")}
                              name={"value-" + p.id}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              defaultValue={
                                sc?.value === null
                                  ? ""
                                  : String(sc?.value ?? "")
                              }
                            />
                            <input
                              className={controlClass}
                              aria-label={"Catatan " + text(p, "full_name")}
                              name={"notes-" + p.id}
                              maxLength={2000}
                              defaultValue={text(sc ?? {}, "notes")}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {edit && (
                      <TextField
                        label="Alasan koreksi"
                        name="reason"
                        required
                      />
                    )}
                  </>
                )}
                <Button disabled={busy}>Simpan</Button>
                {edit && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEdit(null)}
                  >
                    Input baru
                  </Button>
                )}
              </form>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Riwayat penilaian</h2>
            <label>
              Jenis
              <select
                className={controlClass}
                value={historyKind}
                onChange={(e) => setHistoryKind(e.target.value)}
              >
                <option value="">Semua</option>
                {["PH", "ATS", "ASAS", "Praktik"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Nomor PH
              <input
                type="number"
                min="1"
                className={controlClass}
                value={phFilter}
                onChange={(e) => setPhFilter(e.target.value)}
              />
            </label>
            {data.rows
              .filter(
                (r) =>
                  (!historyKind || r.kind === historyKind) &&
                  (!phFilter || String(r.ph_number) === phFilter),
              )
              .map((r) => (
                <article className="rounded border p-4" key={text(r, "id")}>
                  <h3>
                    {text(r, "subject_name")} — {text(r, "kind")}
                    {r.ph_number ? " " + text(r, "ph_number") : ""} —{" "}
                    {text(r, "assessment_date")}
                  </h3>
                  <p>
                    KKM snapshot {text(r, "kkm_snapshot")}
                    {r.kkm_fallback ? " (default75)" : ""}
                  </p>
                  <ul>
                    {list(r.scores).map((sc) => (
                      <li key={text(sc, "student_id")}>
                        {text(sc, "name")}:{" "}
                        {sc.value === null ? "belum diisi" : text(sc, "value")}{" "}
                        — {text(sc, "notes")}
                      </li>
                    ))}
                  </ul>
                  {r.can_edit === true && (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!filters.classId || !filters.subjectId) {
                            setMessage(
                              "Pilih kelas dan mapel sebelum mengoreksi nilai.",
                            );
                            return;
                          }
                          setEdit(r);
                          setTab("main");
                        }}
                      >
                        Koreksi
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const reason = window.prompt(
                            "Alasan pembatalan penilaian (min.3 karakter)",
                          );
                          if (reason)
                            void mutate({ type: "void", id: r.id, reason });
                        }}
                      >
                        Batalkan
                      </Button>
                    </div>
                  )}
                </article>
              ))}
          </section>
        </>
      )}
      {domain === "reports" && (
        <>
          <p>
            Rumus RAPOR-1.0: PH20% + ATS30% + ASAS50%. Praktik tetap terpisah.
            Arsip terbit tidak ditimpa saat KKM atau nilai berubah.
          </p>
          {filters.classId && (
            <>
              <label>
                Jenis rapor
                <select
                  className={controlClass}
                  value={reportKind}
                  onChange={(e) => setReportKind(e.target.value)}
                >
                  {["combined", "PH", "ATS", "ASAS", "Praktik"].map((k) => (
                    <option key={k} value={k}>
                      {k === "combined" ? "Gabungan" : k}
                    </option>
                  ))}
                </select>
              </label>
              <a className="underline" href={selectedUrl}>
                Unduh PDF {selected.length ? "pilihan" : "semua sesuai izin"}
              </a>
              {data.rows.map((r) => {
                const published = obj(r.published),
                  snapshot = Object.keys(published).length
                    ? obj(published.snapshot)
                    : obj(r.draft);
                return (
                  <section
                    className="space-y-2 rounded border p-4"
                    key={text(r, "student_id")}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(text(r, "student_id"))}
                        onChange={(e) =>
                          setSelected((v) =>
                            e.target.checked
                              ? [...v, text(r, "student_id")]
                              : v.filter((x) => x !== r.student_id),
                          )
                        }
                      />{" "}
                      {text(r, "name")} —{" "}
                      {snapshot.draft ? "Draft / sementara" : "Terbit"}
                    </label>
                    <TableRegion label="Tabel data — gulir untuk melihat seluruh kolom"><table className="w-full text-left text-sm"><caption className="sr-only">Data sesuai filter dan hak akses Anda</caption>
                        <thead>
                          <tr>
                            {[
                              "Mapel",
                              "PH",
                              "ATS",
                              "ASAS",
                              "Praktik",
                              "Rapor",
                              "KKM",
                              "Predikat",
                            ].map((x) => (
                              <th scope="col" key={x} className="p-2">
                                {x}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {list(snapshot.subjects).map((s) => (
                            <tr key={text(s, "subject_id")}>
                              {[
                                "name",
                                "ph",
                                "ats",
                                "asas",
                                "practice",
                                "final",
                                "kkm",
                                "grade",
                              ].map((k) => (
                                <td className="border-b p-2" key={k}>
                                  {s[k] === null ? "—" : text(s, k)}
                                  {k === "final" && !s.complete ? " *" : ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableRegion>
                    <a
                      className="underline"
                      href={
                        api +
                        "?" +
                        new URLSearchParams({
                          ...filters,
                          studentId: text(r, "student_id"),
                          kind: reportKind,
                          format: "pdf",
                        })
                      }
                    >
                      Unduh rapor siswa
                    </a>
                  </section>
                );
              })}
              {data.extra.canPublish === true && (
                <form
                  onSubmit={submit}
                  className="space-y-3 rounded border p-4"
                >
                  <label>
                    <input type="checkbox" required /> Saya telah memeriksa
                    komponen nilai dan identitas siswa.
                  </label>
                  <p>
                    Publikasi hanya diterima bila komponen wajib lengkap. Rapor
                    yang sudah terbit dipertahankan; penerbitan ulang menunggu
                    kebijakan koreksi.
                  </p>
                  <Button disabled={busy}>
                    Terbitkan snapshot {selected.length ? "pilihan" : "semua"}
                  </Button>
                </form>
              )}
            </>
          )}
        </>
      )}
      {domain === "promotions" && (
        <>
          {data.isAdmin && (
            <section className="space-y-3 rounded border p-4">
              <div className="flex flex-wrap gap-3">
                {[
                  ["main", "Kenaikan / penempatan"],
                  ["metadata", "Metadata ijazah"],
                  ["access", "Akses ijazah"],
                ].map(([k, v]) => (
                  <Button
                    key={k}
                    type="button"
                    variant={tab === k ? "default" : "outline"}
                    onClick={() => setTab(k ?? "main")}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <form
                onSubmit={submit}
                key={tab + "-" + String(edit?.student_id ?? "new")}
                className="space-y-3"
              >
                {tab === "metadata" ? (
                  <>
                    <SelectField
                      label="Alumni"
                      name="studentId"
                      value={text(edit ?? {}, "student_id")}
                      required
                    >
                      <option value="">Pilih alumni</option>
                      {alumni.map((r) => (
                        <option
                          key={text(r, "student_id")}
                          value={text(r, "student_id")}
                        >
                          {text(r, "name")}
                        </option>
                      ))}
                    </SelectField>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {diplomaFields.map((k) => (
                        <TextField
                          key={k}
                          label={k.replaceAll("_", " ")}
                          name={k}
                          value={text(obj(obj(edit?.diploma).metadata), k)}
                        />
                      ))}
                    </div>
                  </>
                ) : tab === "access" ? (
                  <>
                    <SelectField label="Cakupan" name="scope">
                      <option value="individual">Alumni dipilih</option>
                      <option value="global">Pengaturan global</option>
                    </SelectField>
                    <p>
                      Global hanya berlaku pada override “inherit”. Alumni baru
                      memiliki override “deny”.
                    </p>
                    <label className="mr-4">
                      <input
                        type="checkbox"
                        name="viewGlobal"
                        defaultChecked={
                          obj(data.extra.access).allow_view === true
                        }
                      />{" "}
                      Global boleh melihat
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="downloadGlobal"
                        defaultChecked={
                          obj(data.extra.access).allow_download === true
                        }
                      />{" "}
                      Global boleh mengunduh
                    </label>
                    <SelectField label="Override lihat" name="view">
                      {["deny", "inherit", "allow"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </SelectField>
                    <SelectField label="Override unduh" name="download">
                      {["deny", "inherit", "allow"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </SelectField>
                    <fieldset>
                      <legend>Alumni target</legend>
                      {alumni.map((r) => (
                        <label key={text(r, "student_id")} className="block">
                          <input
                            name="studentIds"
                            type="checkbox"
                            value={text(r, "student_id")}
                          />{" "}
                          {text(r, "name")}
                        </label>
                      ))}
                    </fieldset>
                  </>
                ) : (
                  <>
                    <SelectField label="Tindakan" name="type">
                      <option value="promote">
                        Kenaikan tahun berikutnya (7→8→9→Alumni; calon→7)
                      </option>
                      <option value="place">
                        Penempatan manual / pemulihan status
                      </option>
                    </SelectField>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Tahun asal"
                        name="sourceYearId"
                        required
                      >
                        <option value="">Pilih tahun asal</option>
                        {years.map((y) => (
                          <option value={text(y, "id")} key={text(y, "id")}>
                            {text(y, "start_year")}
                          </option>
                        ))}
                      </SelectField>
                      <SelectField
                        label="Tahun tujuan"
                        name="targetYearId"
                        required
                      >
                        <option value="">Pilih tahun tujuan</option>
                        {years.map((y) => (
                          <option value={text(y, "id")} key={text(y, "id")}>
                            {text(y, "start_year")}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <p>
                      Pilih siswa dan kelas tujuan yang sudah dibuat pada
                      Pengelolaan Kelas. Pilihan Alumni berarti lulus. Tabel ini
                      merupakan pratinjau pemetaan yang akan diproses.
                    </p>
                    <div className="max-h-96 overflow-auto">
                      {data.rows.map((r) => (
                        <div
                          className="grid gap-2 border-b p-2 sm:grid-cols-2"
                          key={text(r, "student_id")}
                        >
                          <label>
                            <input
                              type="checkbox"
                              name={"include-" + r.student_id}
                            />{" "}
                            {text(r, "name")} ({text(r, "role")})
                          </label>
                          <label className="block text-sm">
                            Kelas tujuan untuk {text(r, "name")}
                            <select
                              className={controlClass}
                              name={"class-" + r.student_id}
                            >
                            <option value="">Alumni / lulus</option>
                            {data.classes
                              .filter((c) => !c.archived_at)
                              .map((c) => (
                                <option
                                  key={text(c, "id")}
                                  value={text(c, "id")}
                                >
                                  {text(c, "name")} — {text(c, "year")}
                                </option>
                              ))}
                          </select>
                          </label>
                        </div>
                      ))}
                    </div>
                    <TextField
                      label="Alasan / referensi keputusan"
                      name="reason"
                      required
                    />
                    <label>
                      <input type="checkbox" required /> Saya telah memeriksa
                      siswa, tahun, dan kelas tujuan.
                    </label>
                  </>
                )}
                <Button disabled={busy}>
                  Simpan {tab === "main" ? "pemetaan" : "pengaturan"}
                </Button>
              </form>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Alumni dan dokumen ijazah</h2>
            {alumni.map((r) => (
              <article
                className="space-y-2 rounded border p-4"
                key={text(r, "student_id")}
              >
                <h3 className="font-semibold">{text(r, "name")}</h3>
                {r.diploma ? (
                  <dl className="grid gap-2 sm:grid-cols-3">
                    {Object.entries(obj(obj(r.diploma).metadata)).map(
                      ([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs">{k.replaceAll("_", " ")}</dt>
                          <dd>{String(v)}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                ) : (
                  <p>Metadata belum tersedia atau akses ditolak.</p>
                )}
                {data.isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEdit(r);
                      setTab("metadata");
                    }}
                  >
                    Edit metadata
                  </Button>
                )}
                {list(r.assets).map((a) => (
                  <div key={text(a, "id")}>
                    <span>
                      {text(a, "slot")}: {text(a, "filename")}{" "}
                    </span>
                    {r.canView === true && (
                      <a
                        className="mr-3 underline"
                        target="_blank"
                        rel="noreferrer"
                        href={"/api/learning/assets/" + a.id}
                      >
                        Lihat
                      </a>
                    )}
                    {r.canDownload === true && (
                      <a
                        className="underline"
                        href={"/api/learning/assets/" + a.id + "?download=true"}
                      >
                        Unduh
                      </a>
                    )}
                    {data.isAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const response = await fetch("/api/learning/assets", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "delete",
                              id: a.id,
                            }),
                          });
                          setMessage(String((await response.json()).message));
                          await load();
                        }}
                      >
                        Hapus berkas
                      </Button>
                    )}
                  </div>
                ))}
                {data.isAdmin && (
                  <form onSubmit={upload} className="space-y-2">
                    <input
                      type="hidden"
                      name="targetId"
                      value={text(r, "student_id")}
                    />
                    <SelectField label="Jenis berkas" name="slot">
                      <option>IJAZAH</option>
                      <option>TRANSKRIP</option>
                      <option>SKL</option>
                    </SelectField>
                    <input
                      aria-label="Berkas ijazah"
                      type="file"
                      name="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      required
                    />
                    <Button disabled={busy}>Unggah / ganti berkas</Button>
                  </form>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {domain === "books" && (
        <>
          {data.isAdmin && (
            <section className="rounded border p-4">
              <h2 className="text-xl font-semibold">
                {edit ? "Edit buku" : "Tambah buku"}
              </h2>
              <form
                key={text(edit ?? {}, "id") || "new"}
                onSubmit={submit}
                className="grid gap-3 sm:grid-cols-3"
              >
                {[
                  ["title", "Judul"],
                  ["author", "Penulis"],
                  ["publisher", "Penerbit"],
                  ["year", "Tahun"],
                  ["version", "Versi"],
                  ["category", "Kategori"],
                  ["url", "URL HTTPS lama (opsional)"],
                ].map(([k, label]) => (
                  <TextField
                    key={k}
                    label={label ?? ""}
                    name={k ?? ""}
                    value={text(
                      edit ?? {},
                      k === "year" ? "publication_year" : (k ?? ""),
                    )}
                    required={k === "title"}
                    type={k === "year" ? "number" : "text"}
                  />
                ))}
                <SelectField
                  label="Mapel"
                  name="subjectId"
                  value={text(edit ?? {}, "subject_id")}
                >
                  <option value="">Umum</option>
                  {subjectOptions}
                </SelectField>
                <SelectField
                  label="Tingkat"
                  name="level"
                  value={text(edit ?? {}, "level")}
                >
                  <option value="">Semua</option>
                  {[7, 8, 9].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </SelectField>
                <label>
                  <input
                    type="checkbox"
                    name="premium"
                    defaultChecked={edit?.premium === true}
                  />{" "}
                  Premium
                </label>
                <Button disabled={busy}>Simpan buku</Button>
                {edit && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEdit(null)}
                  >
                    Buku baru
                  </Button>
                )}
              </form>
            </section>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((r) => (
              <article
                className="space-y-3 rounded border p-4"
                key={text(r, "id")}
              >
                <h2 className="text-xl font-semibold">{text(r, "title")}</h2>
                <p>
                  {text(r, "author")} — {text(r, "publisher")}
                </p>
                <p>
                  {text(r, "publication_year")} / {text(r, "version")} /{" "}
                  {text(r, "category")}
                  {r.premium ? " / Premium" : ""}
                </p>
                <Button type="button" onClick={() => setBook(r)}>
                  Baca buku
                </Button>
                {data.isAdmin && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEdit(r)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm("Nonaktifkan buku ini?"))
                          void mutate({
                            type: "void",
                            id: r.id,
                            reason: "Penonaktifan katalog oleh Admin",
                          });
                      }}
                    >
                      Nonaktifkan
                    </Button>
                    <form className="space-y-2" onSubmit={upload}>
                      <input
                        type="hidden"
                        name="targetId"
                        value={text(r, "id")}
                      />
                      <input
                        aria-label="PDF buku"
                        type="file"
                        name="file"
                        accept=".pdf"
                        required
                      />
                      <Button disabled={busy}>Unggah / ganti PDF</Button>
                    </form>
                  </>
                )}
              </article>
            ))}
          </div>
          {book && (
            <BookReader
              key={text(book, "id")}
              assetId={text(list(book.assets)[0] ?? {}, "id") || undefined}
              external={text(book, "external_url") || undefined}
            />
          )}
          <div className="flex gap-4">
            <Button
              variant="outline"
              disabled={Number(data.extra.page) <= 1 || busy}
              onClick={async () => {
                const next = {
                  ...filters,
                  page: String(Number(data.extra.page) - 1),
                };
                await load(next);
                setFilters(next);
              }}
            >
              Sebelumnya
            </Button>
            <span>
              Halaman {String(data.extra.page ?? 1)} /{" "}
              {Math.max(1, Math.ceil(Number(data.extra.total ?? 0) / 50))}
            </span>
            <Button
              variant="outline"
              disabled={
                Number(data.extra.page) * 50 >= Number(data.extra.total) || busy
              }
              onClick={async () => {
                const next = {
                  ...filters,
                  page: String(Number(data.extra.page) + 1),
                };
                await load(next);
                setFilters(next);
              }}
            >
              Berikutnya
            </Button>
          </div>
        </>
      )}
      {data.rows.length === 0 && (
        <p>Belum ada data sesuai pilihan dan izin Anda.</p>
      )}
    </div>
  );
}
