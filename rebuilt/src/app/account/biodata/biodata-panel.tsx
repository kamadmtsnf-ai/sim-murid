"use client";
import Image from "next/image";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import {
  rules,
  enums,
  normalizeBiodata,
  biodataRequest,
  requiredFields,
  studentSnapshot,
  type StudentSnapshot,
  type Biodata,
} from "@/lib/student/validation";
import {
  biodataSections as sections,
  fieldSection,
  fieldLabel as label,
  fieldVisible,
} from "@/lib/student/presentation";
import { documentRow, documentPrepare } from "@/lib/documents/validation";
const fieldClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";
const snapshot = z.object({
  student: studentSnapshot,
  documents: z.array(documentRow),
});
const viewSchema = z.object({
  url: z.url().refine((u) => new URL(u).protocol === "https:"),
  mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  filename: z.string(),
});
type View = z.infer<typeof viewSchema>;
export function BiodataPanel({
  initial,
  initialDocuments,
}: {
  initial: StudentSnapshot;
  initialDocuments: z.infer<typeof documentRow>[];
}) {
  const [student, setStudent] = useState(initial),
    [data, setData] = useState<Biodata>(() => normalizeBiodata(initial.data)),
    [documents, setDocuments] = useState(initialDocuments),
    [section, setSection] = useState("student"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [preview, setPreview] = useState<View | null>(null),
    [download, setDownload] = useState<View | null>(null),
    [zoom, setZoom] = useState(100),
    [kind, setKind] = useState(rules.documents[0]!),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [needsReload, setNeedsReload] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    request = useRef<{ key: string; id: string } | null>(null),
    focusField = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (focusField.current) {
      document.getElementById("biodata-" + focusField.current)?.focus();
      focusField.current = null;
    }
  }, [section, fieldErrors]);
  const required = requiredFields(data),
    fields = rules.fields.filter(
      (k) => fieldSection(k) === section && fieldVisible(k, data),
    );
  function notice(text: string, failed = false) {
    if (mounted.current) {
      setMessage(text);
      setError(failed);
    }
  }
  function update(field: string, value: string | boolean) {
    setData((current) => normalizeBiodata({ ...current, [field]: value }));
    setDirty(true);
    setFieldErrors({});
  }
  function apply(result: z.infer<typeof snapshot>, replaceDraft = true) {
    if (!mounted.current) return;
    setStudent(result.student);
    setDocuments(result.documents);
    if (replaceDraft) {
      setData(normalizeBiodata(result.student.data));
      setDirty(false);
      setFieldErrors({});
    }
    setNeedsReload(false);
  }
  async function response(r: Response) {
    const parsed = z
      .object({ message: z.string().optional() })
      .passthrough()
      .safeParse(await r.json());
    if (!parsed.success)
      throw Error(
        "Respons layanan tidak valid. Periksa kembali data sebelum mencoba.",
      );
    if (!r.ok) throw Error(parsed.data.message ?? "Permintaan belum berhasil.");
    return parsed.data;
  }
  async function reload(replaceDraft = false) {
    const r = await fetch(`/api/student-documents/${student.id}`, {
      cache: "no-store",
    });
    const result = snapshot.parse(await response(r));
    if (result.student.id !== student.id)
      throw Error("Identitas data tidak sesuai.");
    apply(result, replaceDraft);
    return result;
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || !student.can_write || needsReload) return;
    const key = JSON.stringify({ revision: student.revision, data });
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    const parsed = biodataRequest.safeParse({
      requestId: request.current.id,
      revision: student.revision,
      data,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[1] ?? "");
        if (rules.fields.includes(field)) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      if (first) {
        focusField.current = first;
        setSection(fieldSection(first));
      }
      notice(
        "Periksa isian biodata yang ditandai. Isian Anda tetap tersimpan di formulir.",
        true,
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    notice("Menyimpan biodata…");
    try {
      const r = await fetch(`/api/student-profile/${student.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response(r);
      const saved = studentSnapshot.parse(result.student);
      if (saved.id !== student.id) throw Error("Identitas data tidak sesuai.");
      if (mounted.current) {
        setStudent(saved);
        setData(normalizeBiodata(saved.data));
        setDirty(false);
        request.current = null;
      }
      notice(
        typeof result.message === "string"
          ? result.message
          : "Biodata berhasil disimpan.",
      );
    } catch (err) {
      notice(
        err instanceof Error &&
          !(err instanceof TypeError) &&
          !(err instanceof SyntaxError) &&
          !(err instanceof z.ZodError)
          ? err.message
          : "Hasil penyimpanan belum dapat dipastikan. Isian dipertahankan; coba simpan kembali dengan isian yang sama atau muat ulang.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function documentCommand(command: unknown) {
    const r = await fetch(`/api/student-documents/${student.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    return response(r);
  }
  async function recover() {
    try {
      await reload(false);
    } catch {
      if (mounted.current) setNeedsReload(true);
    }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || dirty || needsReload || !student.can_write) return;
    const form = e.currentTarget,
      file = new FormData(form).get("file");
    if (!(file instanceof File)) return;
    const input = documentPrepare.safeParse({
      action: "prepare",
      kind,
      filename: file.name,
      size: file.size,
      mime: file.type,
    });
    if (!input.success) {
      notice(input.error.issues[0]?.message ?? "Periksa berkas.", true);
      return;
    }
    lock.current = true;
    setBusy(true);
    notice("Menyiapkan unggahan privat…");
    setPreview(null);
    setDownload(null);
    try {
      const prepared = z
        .object({
          id: z.uuid(),
          upload: z.object({ path: z.string(), token: z.string() }),
        })
        .parse(await documentCommand(input.data));
      const env = getSupabasePublicEnvironment(),
        storage = createClient(env.url, env.publishableKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }).storage.from("student-documents");
      notice("Mengunggah berkas… Jangan tutup halaman.");
      const r = await storage.uploadToSignedUrl(
        prepared.upload.path,
        prepared.upload.token,
        file,
        { contentType: file.type, cacheControl: "0" },
      );
      if (r.error)
        throw Error(
          "Unggahan belum berhasil. Periksa koneksi. Jika berkas sudah terunggah, gunakan Coba validasi kembali.",
        );
      notice("Memvalidasi isi dokumen…");
      const result = await documentCommand({
        action: "finalize",
        id: prepared.id,
      });
      apply(snapshot.parse(result));
      const fileInput = form.elements.namedItem("file");
      if (fileInput instanceof HTMLInputElement) fileInput.value = "";
      notice(
        typeof result.message === "string"
          ? result.message
          : "Dokumen tersimpan.",
      );
    } catch (err) {
      await recover();
      notice(
        err instanceof Error &&
          !(err instanceof TypeError) &&
          !(err instanceof SyntaxError) &&
          !(err instanceof z.ZodError)
          ? err.message
          : "Unggahan belum berhasil. Periksa daftar dokumen sebelum mengunggah kembali.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function act(
    id: string,
    action: "preview" | "download" | "delete" | "finalize",
  ) {
    const writes = action === "delete" || action === "finalize";
    if (
      lock.current ||
      (writes && (dirty || needsReload || !student.can_write))
    )
      return;
    if (
      action === "delete" &&
      !window.confirm(
        "Hapus dokumen ini? Kelengkapan profil akan diperiksa ulang.",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    notice("Memproses dokumen…");
    setPreview(null);
    setDownload(null);
    try {
      if (!writes) {
        const view = viewSchema.parse(
          await documentCommand({
            action: "download",
            id,
            download: action === "download",
          }),
        );
        if (mounted.current) {
          if (action === "preview") {
            setPreview(view);
            setZoom(100);
          } else setDownload(view);
        }
        notice("Tautan berlaku 60 detik. Buat tautan baru jika kedaluwarsa.");
      } else {
        const result = await documentCommand({ action, id });
        apply(snapshot.parse(result));
        notice(
          typeof result.message === "string"
            ? result.message
            : "Dokumen diperbarui.",
        );
      }
    } catch (err) {
      if (writes) await recover();
      notice(
        err instanceof Error &&
          !(err instanceof TypeError) &&
          !(err instanceof SyntaxError) &&
          !(err instanceof z.ZodError)
          ? err.message
          : "Permintaan belum berhasil. Periksa koneksi dan coba kembali.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function refresh() {
    if (lock.current) return;
    if (
      dirty &&
      !window.confirm(
        "Muat ulang dan batalkan perubahan biodata yang belum disimpan?",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      await reload(true);
      request.current = null;
      setPreview(null);
      setDownload(null);
      notice("Biodata dan daftar dokumen diperbarui.");
    } catch {
      notice(
        "Data belum dapat dimuat ulang. Isian Anda tetap dipertahankan.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-6" aria-busy={busy}>
      <header className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-primary">Data pribadi siswa</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Biodata dan dokumen
        </h1>
        <p className="break-words [overflow-wrap:anywhere]">
          {student.name}{" "}
          <span className="text-muted-foreground">(@{student.username})</span>
        </p>
      </header>
      <section
        aria-label="Kelengkapan profil"
        className="space-y-3 rounded-xl border bg-card p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Kelengkapan tersimpan</h2>
          <strong>{student.progress.percent}%</strong>
        </div>
        <progress
          className="h-2 w-full accent-primary"
          value={student.progress.percent}
          max={100}
          aria-label="Kelengkapan profil tersimpan"
        />
        <p className="text-sm text-muted-foreground">
          Tanda * menunjukkan isian wajib untuk kelengkapan. Biodata yang belum
          lengkap tetap dapat disimpan sebagai draf.
        </p>
        {dirty && (
          <p className="text-sm font-medium">
            Ada perubahan yang belum disimpan.
          </p>
        )}
      </section>
      {!student.can_write && (
        <p className="rounded-lg border bg-muted/30 p-4 text-sm">
          Akses baca. Biodata dan dokumen hanya dapat diubah pemilik akun atau
          Admin.
        </p>
      )}
      <nav
        aria-label="Bagian biodata"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {sections.map(([value, title]) => (
          <Button
            key={value}
            type="button"
            disabled={busy}
            variant={section === value ? "default" : "outline"}
            aria-pressed={section === value}
            aria-controls="biodata-section"
            onClick={() => setSection(value)}
          >
            {title}
          </Button>
        ))}
      </nav>
      <div
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
        className={
          message
            ? "rounded-lg border p-3 text-sm break-words [overflow-wrap:anywhere] " +
              (error ? "border-destructive text-destructive" : "bg-muted/30")
            : ""
        }
      >
        {message}
      </div>
      {needsReload && (
        <p className="rounded border border-destructive p-3 text-sm">
          Status dokumen belum dapat diperiksa. Muat ulang sebelum mengubah
          dokumen lagi.
        </p>
      )}
      <Card id="biodata-section" className="min-w-0">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>
            <h2>{sections.find((s) => s[0] === section)?.[1]}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 px-4 sm:px-6">
          {section !== "documents" ? (
            <form noValidate onSubmit={(e) => void save(e)}>
              <fieldset
                disabled={busy || !student.can_write}
                className="min-w-0 space-y-5"
              >
                <legend className="sr-only">
                  {sections.find((s) => s[0] === section)?.[1]}
                </legend>
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  {fields.map((field) =>
                    rules.booleans.includes(field) ? (
                      <label
                        className="flex min-h-11 items-center gap-3 text-sm"
                        key={field}
                      >
                        <input
                          id={"biodata-" + field}
                          type="checkbox"
                          className="size-5 shrink-0 accent-primary"
                          checked={data[field] === true}
                          onChange={(e) => update(field, e.target.checked)}
                        />
                        {label(field)}
                      </label>
                    ) : (
                      <div className="min-w-0" key={field}>
                        <label
                          htmlFor={"biodata-" + field}
                          className="text-sm font-medium"
                        >
                          {label(field)}
                          {required.includes(field) ? " *" : ""}
                        </label>
                        {enums[field] ? (
                          <select
                            id={"biodata-" + field}
                            className={fieldClass}
                            value={String(data[field] ?? "")}
                            aria-invalid={!!fieldErrors[field]}
                            aria-describedby={
                              fieldErrors[field] ? "error-" + field : undefined
                            }
                            onChange={(e) => update(field, e.target.value)}
                          >
                            <option value="">Pilih…</option>
                            {enums[field]?.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={"biodata-" + field}
                            className={fieldClass}
                            maxLength={500}
                            type={
                              field.endsWith("TanggalLahir") ||
                              field === "TanggalLahir"
                                ? "date"
                                : field === "Email"
                                  ? "email"
                                  : "text"
                            }
                            inputMode={
                              field === "Email"
                                ? "email"
                                : field.endsWith("NoHP")
                                  ? "tel"
                                  : field.includes("NIK") ||
                                      field === "NomorKK" ||
                                      field === "JumlahSaudara" ||
                                      field === "AnakKe"
                                    ? "numeric"
                                    : undefined
                            }
                            value={String(data[field] ?? "")}
                            aria-invalid={!!fieldErrors[field]}
                            aria-describedby={
                              fieldErrors[field] ? "error-" + field : undefined
                            }
                            onChange={(e) => update(field, e.target.value)}
                          />
                        )}{" "}
                        {fieldErrors[field] && (
                          <p
                            id={"error-" + field}
                            className="mt-1 text-sm text-destructive"
                          >
                            {fieldErrors[field]}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
                {section === "guardian" && data.WaliPilihan !== "Lainnya" && (
                  <p className="rounded-lg bg-muted/40 p-3 text-sm">
                    Biodata wali mengikuti data{" "}
                    {String(data.WaliPilihan || "ayah/ibu")}. Hubungan akun
                    Orang Tua tetap diverifikasi Admin secara terpisah.
                  </p>
                )}
                {student.can_write && (
                  <Button
                    type="submit"
                    disabled={needsReload}
                    className="w-full sm:w-auto"
                  >
                    {busy ? "Menyimpan…" : "Simpan biodata / draf"}
                  </Button>
                )}
              </fieldset>
            </form>
          ) : (
            <div className="min-w-0 space-y-5">
              <p className="text-sm text-muted-foreground">
                Dokumen disimpan privat. PDF untuk KK, Akta, dan Ijazah;
                PNG/JPEG untuk kartu bantuan, BPJS, dan KTP. Maksimal 50 MiB per
                berkas.
              </p>
              <p className="text-sm break-words">
                Dokumen wajib belum lengkap:{" "}
                <strong>
                  {student.progress.missingDocuments.join(", ") || "tidak ada"}
                </strong>
                .
              </p>
              {dirty && (
                <p className="rounded-lg border p-3 text-sm">
                  Simpan biodata sebelum mengunggah, memvalidasi, atau menghapus
                  dokumen.
                </p>
              )}
              {student.can_write && (
                <form onSubmit={(e) => void upload(e)}>
                  <fieldset
                    disabled={busy || dirty || needsReload}
                    className="grid min-w-0 gap-4 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2"
                  >
                    <legend className="px-1 text-sm font-medium">
                      Unggah dokumen
                    </legend>
                    <div className="min-w-0">
                      <label
                        htmlFor="document-kind"
                        className="text-sm font-medium"
                      >
                        Jenis dokumen
                      </label>
                      <select
                        id="document-kind"
                        name="kind"
                        className={fieldClass}
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        {rules.documents.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor="document-file"
                        className="text-sm font-medium"
                      >
                        Berkas
                      </label>
                      <input
                        id="document-file"
                        type="file"
                        name="file"
                        required
                        className="mt-1 block min-h-11 w-full min-w-0 max-w-full text-sm file:mr-2 file:rounded file:border file:px-2 file:py-2"
                        accept={
                          ["KK", "AKTA", "IJAZAH_MI", "IJAZAH_TK"].includes(
                            kind,
                          )
                            ? "application/pdf"
                            : "image/png,image/jpeg"
                        }
                      />
                    </div>
                    <Button type="submit" className="w-full sm:w-fit">
                      Unggah dan validasi
                    </Button>
                  </fieldset>
                </form>
              )}
              {!documents.length ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <h3 className="font-medium">Belum ada dokumen</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dokumen yang telah diunggah akan tampil di sini.
                  </p>
                </div>
              ) : (
                <ul className="min-w-0 space-y-3">
                  {documents.map((doc) => (
                    <li
                      className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4"
                      key={doc.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold">{doc.kind}</h3>
                        <span className="rounded bg-muted px-2 py-1 text-xs">
                          {doc.state === "ready"
                            ? "Siap"
                            : doc.state === "pending"
                              ? "Menunggu unggahan / validasi"
                              : "Penghapusan belum selesai"}
                        </span>
                      </div>
                      <p className="break-words text-sm [overflow-wrap:anywhere]">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.ceil(doc.size / 1024).toLocaleString("id-ID")} KiB
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {doc.state === "ready" && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              aria-label={"Pratinjau " + doc.kind}
                              onClick={() => void act(doc.id, "preview")}
                            >
                              Pratinjau
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              aria-label={"Unduh " + doc.kind}
                              onClick={() => void act(doc.id, "download")}
                            >
                              Unduh
                            </Button>
                          </>
                        )}
                        {student.can_write && doc.state === "pending" && (
                          <Button
                            type="button"
                            variant="outline"
                            className="max-w-full whitespace-normal"
                            disabled={busy || dirty || needsReload}
                            onClick={() => void act(doc.id, "finalize")}
                          >
                            Coba validasi kembali
                          </Button>
                        )}
                        {student.can_write && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy || dirty || needsReload}
                            aria-label={"Hapus " + doc.kind}
                            onClick={() => void act(doc.id, "delete")}
                          >
                            {doc.state === "deleting"
                              ? "Ulangi hapus"
                              : "Hapus"}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {download && (
                <a
                  href={download.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block min-h-11 break-words rounded border p-3 text-sm text-primary underline [overflow-wrap:anywhere]"
                >
                  Unduh {download.filename} (tautan 60 detik)
                </a>
              )}
              {preview && (
                <section
                  aria-label="Pratinjau dokumen"
                  className="min-w-0 space-y-3 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">
                      {preview.filename}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPreview(null)}
                    >
                      Tutup pratinjau
                    </Button>
                  </div>
                  {preview.mime === "application/pdf" ? (
                    <iframe
                      src={preview.url}
                      title={"PDF " + preview.filename}
                      referrerPolicy="no-referrer"
                      className="h-[65dvh] w-full rounded border"
                    />
                  ) : (
                    <>
                      <label className="flex flex-wrap items-center gap-3 text-sm">
                        Zoom {zoom}%
                        <input
                          type="range"
                          min={50}
                          max={200}
                          step={10}
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                        />
                      </label>
                      <div
                        className="max-h-[65dvh] overflow-auto"
                        tabIndex={0}
                        aria-label="Gambar dokumen, gulir untuk melihat seluruh gambar"
                      >
                        <Image
                          unoptimized
                          src={preview.url}
                          alt={preview.filename}
                          width={1200}
                          height={1600}
                          style={{
                            width: `${zoom}%`,
                            height: "auto",
                            maxWidth: "none",
                          }}
                          onError={() =>
                            notice(
                              "Pratinjau tidak tersedia atau tautan kedaluwarsa. Klik Pratinjau kembali.",
                              true,
                            )
                          }
                        />
                      </div>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Klik Pratinjau atau Unduh kembali jika tautan kedaluwarsa.
                  </p>
                </section>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Muat ulang
        </Button>
        {section === "documents" && dirty && (
          <Button
            type="button"
            className="max-w-full whitespace-normal"
            disabled={busy}
            onClick={() => setSection("student")}
          >
            Kembali untuk menyimpan biodata
          </Button>
        )}
      </div>
    </div>
  );
}
