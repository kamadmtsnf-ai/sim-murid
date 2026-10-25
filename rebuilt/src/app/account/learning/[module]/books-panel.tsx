"use client";
import {confirmAction} from "@/components/ui/confirm-action";
import { Pagination } from "@/components/ui/collection-controls";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  TextField,
  SelectField,
  controlClass,
} from "@/components/domain-controls";
import { createClient } from "@/lib/supabase/client";
import { assetPrepare, commands, messages } from "@/lib/learning/validation";
import {
  bookFilters,
  booksSnapshot,
  bookLocator,
  type Book,
  type BooksSnapshot,
} from "@/lib/learning/books";
import { BookReader } from "./reader";
const api = "/api/learning/books";
type Scope = Record<string, string>;
class Rejected extends Error {
  constructor(
    message: string,
    readonly blocked = false,
  ) {
    super(message);
  }
}
export function BooksPanel({ initial }: { initial: BooksSnapshot }) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Scope>({}),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [dialog, setDialog] = useState<"book" | "upload" | null>(null),
    [edit, setEdit] = useState<Book | null>(null),
    [book, setBook] = useState<Book | null>(null),
    [dirty, setDirty] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    opener = useRef<HTMLElement | null>(null),
    refresh = useRef<HTMLButtonElement>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  useWriteGuard(
    () => lock.current,
    () => blocked,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const stopUnloadGuard = listenForUnsavedChanges(warn);
    return () => stopUnloadGuard();
  }, [dirty]);
  async function close() {
    if (lock.current) return;
    if (dirty && !await confirmAction("Buang isian yang belum disimpan?")) return;
    setDialog(null);
    setDirty(false);
  }
  function open(
    kind: "book" | "upload",
    row: Book | null,
    target: HTMLElement,
  ) {
    opener.current = target;
    setEdit(row);
    setDirty(false);
    setDialog(kind);
  }
  async function json(url: string, init: RequestInit = {}) {
    const c = new AbortController();
    controller.current = c;
    const timer = setTimeout(() => c.abort(), 30000);
    try {
      const r = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: c.signal,
      });
      const body: unknown = await r.json();
      if (!body || typeof body !== "object") throw Error("Invalid response");
      const b = body as Record<string, unknown>;
      if (!r.ok) {
        if (r.status >= 500) throw Error("Unavailable");
        throw new Rejected(
          typeof b.message === "string"
            ? b.message
            : "Permintaan belum berhasil.",
          [401, 403].includes(r.status) ||
            ["stale", "not_found", "request_conflict"].includes(String(b.code)),
        );
      }
      return b;
    } finally {
      clearTimeout(timer);
      if (controller.current === c) controller.current = null;
    }
  }
  async function read(next: Scope) {
    let result = booksSnapshot.parse(
      (await json(api + "?" + new URLSearchParams(next))).data,
    );
    const last = Math.max(1, Math.ceil(result.extra.total / 50));
    if (result.extra.page > last) {
      next = { ...next, page: String(last) };
      result = booksSnapshot.parse(
        (await json(api + "?" + new URLSearchParams(next))).data,
      );
    }
    if (!mounted.current) return;
    setData(result);
    setFilters(next);
    setBook(null);
  }
  async function run(task: () => Promise<void>, write = false) {
    if (lock.current || (write && blocked)) return;
    lock.current = true;
    setBusy(true);
    setMessage(write ? "Menyimpan perubahan…" : "Memuat katalog…");
    try {
      await task();
    } catch (e) {
      if (mounted.current) {
        if (write && (!(e instanceof Rejected) || e.blocked)) setBlocked(true);
        setMessage(
          e instanceof Rejected
            ? e.message
            : write
              ? "Hasil perubahan belum dapat dipastikan. Muat ulang katalog untuk memeriksa hasil sebelum mencoba kembali."
              : "Katalog belum dapat dimuat. Periksa koneksi dan coba muat ulang.",
        );
      }
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        requestAnimationFrame(() => feedback.current?.focus());
      }
    }
  }
  async function reload(next = filters) {
    if (
      dialog &&
      dirty &&
      !await confirmAction("Buang isian yang belum disimpan dan muat ulang?")
    )
      return;
    await run(async () => {
      await read(next);
      if (!mounted.current) return;
      setBlocked(false);
      setDialog(null);
      setDirty(false);
      setMessage(
        "Katalog berhasil dimuat ulang. Periksa data sebelum melanjutkan.",
      );
    });
  }
  async function save(command: unknown) {
    const valid = commands.books.safeParse(command);
    if (!valid.success) {
      setMessage("Periksa isian buku, tahun terbit 1800–2200, dan URL HTTPS.");
      return;
    }
    await run(async () => {
      const b = await json(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          revision: data.revision,
          command: valid.data,
        }),
      });
      const ack = z
        .object({
          code: z.literal("saved"),
          result: z.object({ code: z.literal("saved"), id: z.uuid() }),
        })
        .parse(b);
      if (valid.data.id && ack.result.id !== valid.data.id)
        throw Error("Wrong book");
      if (!mounted.current) return;
      setDialog(null);
      setDirty(false);
      setBook(null);
      try {
        await read({ ...filters, page: "1" });
      } catch {
        if (mounted.current) {
          setBlocked(true);
          setMessage(
            "Perubahan tersimpan, tetapi katalog belum dapat diperbarui. Muat ulang untuk memeriksa data.",
          );
        }
        return;
      }
      if (mounted.current) setMessage(messages.saved ?? "Buku tersimpan.");
    }, true);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? "");
    void save({
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
    });
  }
  function filter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = Object.fromEntries(
      [...new FormData(e.currentTarget)]
        .map(([k, v]) => [k, String(v).trim()])
        .filter(([, v]) => v),
    );
    if (!bookFilters.safeParse(next).success) {
      setMessage("Periksa filter pencarian.");
      return;
    }
    void reload(next);
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = new FormData(e.currentTarget).get("file");
    if (!(file instanceof File) || !edit) return;
    const input = assetPrepare.safeParse({
      action: "prepare",
      kind: "book",
      targetId: edit.id,
      filename: file.name,
      mime: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : ""),
      size: file.size,
    });
    if (!input.success) {
      setMessage(
        "Pilih berkas PDF berukuran 1 byte hingga 50 MB; nama maksimal 200 karakter.",
      );
      return;
    }
    await run(async () => {
      const prepared = z
        .object({
          id: z.uuid(),
          upload: z.object({ path: z.string(), token: z.string().min(1) }),
        })
        .parse(
          await json("/api/learning/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input.data),
          }),
        );
      if (prepared.upload.path !== `book/${edit.id}/${prepared.id}`)
        throw Error("Unexpected upload path");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const stored = await Promise.race([
          createClient()
            .storage.from("learning-private")
            .uploadToSignedUrl(
              prepared.upload.path,
              prepared.upload.token,
              file,
              { contentType: "application/pdf" },
            ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(Error("Upload timeout")), 60000);
          }),
        ]);
        if (stored.error) throw Error("Upload failed");
      } finally {
        clearTimeout(timer);
      }
      if (!mounted.current) return;
      const final = z
        .object({
          code: z.literal("saved"),
          id: z.uuid(),
          action: z.literal("finalize"),
        })
        .parse(
          await json("/api/learning/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "finalize", id: prepared.id }),
          }),
        );
      if (final.id !== prepared.id) throw Error("Unexpected asset");
      if (!mounted.current) return;
      setDialog(null);
      setDirty(false);
      setBook(null);
      try {
        await read(filters);
      } catch {
        if (mounted.current) {
          setBlocked(true);
          setMessage(
            "PDF tersimpan, tetapi katalog belum dapat diperbarui. Muat ulang sebelum melanjutkan.",
          );
        }
        return;
      }
      if (mounted.current) setMessage("PDF berhasil diunggah dan divalidasi.");
    }, true);
  }
  const disabled = busy || blocked,
    subjects = data.extra.subjects,
    editable = data.isAdmin && data.canWrite;
  const options = subjects.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ));
  return (
    <div className="books-panel space-y-6" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground">
            Temukan bahan belajar dan baca buku sesuai akses akun Anda.
          </p>
          <p className="mt-2 text-sm">
            {data.extra.total} buku sesuai filter dan izin akses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            ref={refresh}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void reload()}
          >
            <RefreshCw aria-hidden="true" />
            Muat ulang
          </Button>
          {editable && (
            <Button
              type="button"
              disabled={disabled}
              onClick={(e) => open("book", null, e.currentTarget)}
            >
              <Plus aria-hidden="true" />
              Tambah buku
            </Button>
          )}
        </div>
      </div>
      {message && (
        <p
          ref={feedback}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-lg border bg-muted p-3 text-sm"
        >
          {message}
        </p>
      )}
      <form
        onSubmit={filter}
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filter katalog"
      >
        <TextField label="Cari judul atau penulis" name="query" max={100} />
        <SelectField label="Mata pelajaran" name="subjectId">
          <option value="">Semua mata pelajaran</option>
          {options}
        </SelectField>
        <TextField label="Kategori" name="category" max={200} />
        <SelectField label="Tingkat" name="level">
          <option value="">Semua tingkat</option>
          {[7, 8, 9].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </SelectField>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button disabled={busy}>Terapkan filter</Button>
          <Button
            type="reset"
            variant="outline"
            disabled={busy}
            onClick={() => void reload({})}
          >
            Reset filter
          </Button>
        </div>
      </form>
      {!data.rows.length && (
        <section className="rounded-xl border border-dashed bg-card p-6 text-center">
          <BookOpen
            aria-hidden="true"
            className="mx-auto mb-3 text-muted-foreground"
          />
          <h2 className="text-lg font-semibold">
            Belum ada buku yang ditampilkan
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Coba ubah filter. Buku premium hanya ditampilkan kepada akun yang
            memiliki akses.
          </p>
        </section>
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.rows.map((r) => (
          <article
            key={r.id}
            className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-secondary px-3 py-1">
                {r.premium ? "Premium" : "Umum"}
              </span>
              <span className="rounded-full border px-3 py-1">
                {r.assets.length
                  ? "PDF tersedia"
                  : bookLocator(r.external_url ?? undefined)
                    ? "Sumber eksternal"
                    : "Belum ada berkas"}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {r.title.length > 100 ? r.title.slice(0, 100) + "…" : r.title}
              </h2>
              {r.title.length > 100 && (
                <details className="text-sm">
                  <summary className="flex min-h-11 cursor-pointer items-center text-primary underline">
                    Lihat judul lengkap
                  </summary>
                  <p>{r.title}</p>
                </details>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {r.author || "Penulis belum dicantumkan"}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Penerbit", r.publisher || "—"],
                ["Tahun terbit", r.publication_year ?? "—"],
                ["Kategori", r.category || "Umum"],
                ["Versi", r.version || "—"],
                [
                  "Mata pelajaran",
                  subjects.find((s) => s.id === r.subject_id)?.name ??
                    (r.subject_id ? "Mata pelajaran nonaktif" : "Umum"),
                ],
                ["Tingkat", r.level ?? "Semua"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  busy ||
                  (!r.assets.length &&
                    !bookLocator(r.external_url ?? undefined))
                }
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setBook(r);
                }}
              >
                <BookOpen aria-hidden="true" />
                Baca buku
              </Button>
              {editable && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={(e) => open("book", r, e.currentTarget)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={(e) => open("upload", r, e.currentTarget)}
                  >
                    {r.assets.length ? "Ganti PDF" : "Unggah PDF"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={disabled}
                    onClick={async () => {
                      if (await confirmAction(`Nonaktifkan buku “${r.title}”?`))
                        void save({
                          type: "void",
                          id: r.id,
                          reason: "Penonaktifan katalog oleh Admin",
                        });
                    }}
                  >
                    Nonaktifkan
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      <Pagination
        label="Halaman katalog"
        page={data.extra.page}
        pageCount={Math.max(1, Math.ceil(data.extra.total / 50))}
        disabled={busy}
        onPageChange={(page) => void reload({ ...filters, page: String(page) })}
      />
      <Dialog
        open={dialog !== null}
        onOpenChange={async (v) => {
          if (!v) await close();
        }}
        title={
          dialog === "upload"
            ? "Unggah PDF buku"
            : edit
              ? "Edit buku"
              : "Tambah buku"
        }
        description={
          dialog === "upload"
            ? "PDF maksimal 50 MB. Berkas lama tetap tersedia sampai penggantinya selesai divalidasi."
            : "Lengkapi informasi katalog. Judul wajib diisi; URL eksternal bersifat opsional."
        }
        className="books-dialog"
        returnFocusRef={opener}
      >
        <form
          key={`${dialog}:${edit?.id ?? "new"}`}
          onSubmit={dialog === "upload" ? upload : submit}
          onChange={() => setDirty(true)}
          className="space-y-4"
        >
          <fieldset disabled={disabled} className="space-y-4">
            {dialog === "upload" ? (
              <>
                <p className="font-medium">{edit?.title}</p>
                <label className="block text-sm">
                  Berkas PDF
                  <input
                    className={controlClass}
                    name="file"
                    type="file"
                    accept=".pdf,application/pdf"
                    required
                  />
                </label>
                {edit?.assets[0] && (
                  <p className="text-sm text-muted-foreground">
                    Berkas saat ini: {edit.assets[0].filename}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Judul"
                    name="title"
                    required
                    max={300}
                    value={edit?.title}
                  />
                  <TextField
                    label="Penulis"
                    name="author"
                    max={2000}
                    value={edit?.author}
                  />
                  <TextField
                    label="Penerbit"
                    name="publisher"
                    max={2000}
                    value={edit?.publisher}
                  />
                  <label className="block text-sm">
                    Tahun terbit
                    <input
                      className={controlClass}
                      name="year"
                      type="number"
                      min={1800}
                      max={2200}
                      step={1}
                      defaultValue={edit?.publication_year ?? ""}
                    />
                  </label>
                  <TextField
                    label="Versi"
                    name="version"
                    max={2000}
                    value={edit?.version}
                  />
                  <TextField
                    label="Kategori"
                    name="category"
                    max={2000}
                    value={edit?.category}
                  />
                  <SelectField
                    label="Mata pelajaran"
                    name="subjectId"
                    value={edit?.subject_id ?? ""}
                  >
                    <option value="">Umum</option>
                    {edit?.subject_id &&
                      !subjects.some((s) => s.id === edit.subject_id) && (
                        <option value={edit.subject_id}>
                          Mata pelajaran nonaktif
                        </option>
                      )}
                    {options}
                  </SelectField>
                  <SelectField
                    label="Tingkat"
                    name="level"
                    value={String(edit?.level ?? "")}
                  >
                    <option value="">Semua tingkat</option>
                    {[7, 8, 9].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </SelectField>
                </div>
                <TextField
                  label="URL buku eksternal (HTTPS)"
                  name="url"
                  type="url"
                  max={10000}
                  value={edit?.external_url ?? ""}
                />
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="premium"
                    defaultChecked={edit?.premium ?? false}
                  />
                  Hanya untuk akun dengan akses premium
                </label>
              </>
            )}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Batal
            </Button>
            <Button disabled={disabled}>
              {busy
                ? "Memproses…"
                : dialog === "upload"
                  ? "Unggah dan validasi"
                  : "Simpan buku"}
            </Button>
          </div>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </form>
      </Dialog>
      <Dialog
        open={book !== null}
        onOpenChange={(v) => {
          if (!v) setBook(null);
        }}
        title={book?.title ?? "Pembaca buku"}
        description="Baca per halaman atau gulir. Gunakan tampilan standar jika PDF tidak dapat dirender."
        className="books-dialog books-reader-dialog"
        returnFocusRef={opener}
      >
        {book && (
          <BookReader
            key={book.id + ":" + (book.assets[0]?.id ?? "")}
            assetId={book.assets[0]?.id}
            external={book.external_url ?? undefined}
          />
        )}
      </Dialog>
    </div>
  );
}
