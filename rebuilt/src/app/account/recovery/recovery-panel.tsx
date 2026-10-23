"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { controlClass } from "@/components/domain-controls";
import {
  recoveryListSchema,
  recoveryResolveSchema,
  recoveryResolutionSchema,
  type RecoveryList,
} from "@/lib/auth/recovery-validation";
const date = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const typeName = { password: "Password", session: "Sesi" };
const pageSize = 10;
/** An interrupted recovery can commit. Refresh reads; it never replays a write. */
export function RecoveryPanel({
  initialRequests,
}: {
  initialRequests: RecoveryList;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false),
    [message, setMessage] = useState(""),
    [tone, setTone] = useState<"info" | "error" | "success">("info"),
    [password, setPassword] = useState(""),
    [recipient, setRecipient] = useState(""),
    [now, setNow] = useState<number | null>(null);
  const inFlight = useRef(false),
    mounted = useRef(true),
    abort = useRef<AbortController | null>(null),
    formRef = useRef<HTMLFormElement>(null),
    feedback = useRef<HTMLDivElement>(null),
    selectRef = useRef<HTMLSelectElement>(null),
    passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(tick);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  useEffect(() => {
    if (password) passwordRef.current?.focus();
  }, [password]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (inFlight.current || password) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [password]);
  const current = requests.find((r) => r.id === selected);
  const expired = (r: RecoveryList[number]) =>
    now !== null && Date.parse(r.expires_at) <= now;
  const disabled = busy || locked || Boolean(password);
  const term = query.trim().toLocaleLowerCase("id-ID");
  const filtered = requests.filter(
    (r) =>
      (filter === "all" || r.request_type === filter) &&
      (!term ||
        `${r.full_name} ${r.username}`
          .toLocaleLowerCase("id-ID")
          .includes(term)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    visiblePage = Math.min(page, pages);
  const visible = filtered.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );
  function chooseRequest(requestId: string) {
    setSelected(requestId);
    for (const name of [
      "currentPassword",
      "evidenceReference",
      "identityConfirmed",
    ]) {
      const field = formRef.current?.elements.namedItem(name);
      if (field instanceof HTMLInputElement) {
        if (field.type === "checkbox") field.checked = false;
        else field.value = "";
      }
    }
  }
  function notify(text: string, kind: typeof tone = "error") {
    setTone(kind);
    setMessage(text);
  }
  async function refresh() {
    if (inFlight.current || password) return;
    const evidence = formRef.current?.elements.namedItem("evidenceReference");
    if (
      !locked &&
      (selected || (evidence instanceof HTMLInputElement && evidence.value)) &&
      !window.confirm(
        "Muat ulang antrean dan kosongkan isian pemeriksaan saat ini?",
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/account/recovery", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!mounted.current) return;
      if (response.status === 401) {
        setLocked(true);
        router.replace("/login?expired=1");
        return;
      }
      if (response.status === 403) {
        setLocked(true);
        notify(
          "Hak akses berubah. Selesaikan keamanan akun atau hubungi Admin lain.",
        );
        return;
      }
      const body: unknown = await response.json();
      const list = recoveryListSchema.safeParse(
        typeof body === "object" && body !== null && "requests" in body
          ? body.requests
          : null,
      );
      if (!response.ok || !list.success) throw Error("Queue unavailable");
      if (!mounted.current) return;
      setRequests(list.data);
      setSelected("");
      setPage(1);
      setNow(Date.now());
      setLocked(false);
      formRef.current?.reset();
      notify(
        "Antrean diperbarui. Periksa kembali status sebelum memproses permintaan.",
        "success",
      );
    } catch {
      if (mounted.current) {
        setLocked(true);
        notify(
          "Antrean belum dapat dimuat. Coba muat ulang antrean; jangan mengulang pemulihan sebelum status diperiksa.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (mounted.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || disabled) return;
    const form = event.currentTarget,
      fields = Object.fromEntries(new FormData(form));
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action =
      submitter instanceof HTMLButtonElement ? submitter.value : "approve";
    const input = recoveryResolveSchema.safeParse({
      ...fields,
      action,
      identityConfirmed: fields.identityConfirmed === "on",
    });
    if (!input.success) {
      notify(
        "Lengkapi konfirmasi identitas, referensi 8–120 karakter sesuai petunjuk, dan password Admin.",
      );
      return;
    }
    const target = requests.find((r) => r.id === input.data.requestId);
    if (
      !target ||
      target.self_request ||
      Date.parse(target.expires_at) <= Date.now()
    ) {
      setLocked(true);
      notify(
        "Permintaan sudah kedaluwarsa atau tidak dapat diproses. Muat ulang antrean.",
      );
      return;
    }
    const verb =
      action === "reject"
        ? "Tolak permintaan"
        : target.request_type === "password"
          ? "Buat password sementara dan cabut seluruh sesi"
          : "Cabut seluruh sesi aplikasi";
    if (
      !window.confirm(
        `${verb} untuk ${target.full_name} (@${target.username})?`,
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/account/recovery", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
        signal: controller.signal,
      });
      if (!mounted.current) return;
      if (response.status === 401) {
        setLocked(true);
        router.replace("/login?expired=1");
        return;
      }
      const body: unknown = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        if ([400, 429].includes(response.status)) {
          notify(
            response.status === 429
              ? "Batas percobaan tercapai. Coba lagi setelah 15 menit."
              : "Password Admin tidak sesuai atau isian tidak valid. Periksa kembali.",
          );
          return;
        }
        setLocked(true);
        notify(
          response.status === 403
            ? "Hak akses berubah. Muat ulang antrean atau hubungi Admin lain."
            : response.status === 409
              ? "Permintaan berubah, kedaluwarsa, atau sedang diproses. Muat ulang antrean."
              : "Hasil pemulihan belum dapat dipastikan. Jangan menyerahkan password atau mengulang tindakan. Muat ulang antrean; finalisasi tertunda dapat diproses kembali setelah dua menit atau oleh operator.",
        );
        return;
      }
      const parsed = recoveryResolutionSchema.safeParse(body),
        outcome = action === "reject" ? "rejected" : target.request_type;
      if (
        !parsed.success ||
        parsed.data.requestId !== target.id ||
        parsed.data.outcome !== outcome
      )
        throw Error("Unconfirmed result");
      setRequests((list) => list.filter((r) => r.id !== target.id));
      setSelected("");
      form.reset();
      if (parsed.data.outcome === "password") {
        setRecipient(`${target.full_name} (@${target.username})`);
        setPassword(parsed.data.temporaryPassword);
      }
      notify(parsed.data.message, "success");
    } catch {
      if (mounted.current) {
        setLocked(true);
        notify(
          "Hasil pemulihan belum dapat dipastikan. Jangan mengulang tindakan. Muat ulang antrean untuk memeriksa status; jika permintaan telah selesai tetapi password tidak diterima, pengguna perlu mengajukan pemulihan baru.",
        );
      }
    } finally {
      clearTimeout(timer);
      const field = form.elements.namedItem("currentPassword");
      if (field instanceof HTMLInputElement) field.value = "";
      if (mounted.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="account-recovery-panel min-w-0 space-y-6">
      <Status>
        Antrean berisi maksimal 100 permintaan aktif tertua, berlaku 24 jam.
        Verifikasi identitas melalui prosedur madrasah; jawaban keamanan hanya
        bukti tambahan. Permintaan akun Anda sendiri harus ditangani Admin lain
        atau operator tepercaya.
      </Status>
      <div
        ref={feedback}
        tabIndex={-1}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {message && <Status tone={tone}>{message}</Status>}
      </div>
      {password && (
        <Card>
          <CardHeader>
            <CardTitle>Password sementara</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="break-words">
              Untuk <strong>{recipient}</strong>. Serahkan langsung setelah
              verifikasi identitas. Pengguna wajib menggantinya saat masuk.
              Password hanya ditampilkan pada halaman ini dan tidak disimpan di
              penyimpanan browser.
            </p>
            <label className="block text-sm" htmlFor="recovery-temporary">
              Password baru
              <input
                ref={passwordRef}
                id="recovery-temporary"
                type="text"
                autoComplete="off"
                spellCheck={false}
                className={controlClass}
                value={password}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <Button
              onClick={() => {
                if (
                  !window.confirm(
                    "Pastikan password telah diserahkan dengan aman. Hapus tampilan password?",
                  )
                )
                  return;
                setPassword("");
                setRecipient("");
                notify("Tampilan password telah dihapus.", "success");
              }}
            >
              Selesai menyerahkan, hapus tampilan
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <CardTitle>Antrean pemulihan ({requests.length})</CardTitle>
            <Button
              variant="outline"
              disabled={busy || Boolean(password)}
              onClick={() => void refresh()}
            >
              {busy ? "Memproses…" : "Muat ulang antrean"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4" aria-busy={busy}>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block text-sm" htmlFor="recovery-search">
              Cari nama atau username
              <input
                id="recovery-search"
                type="search"
                className={controlClass}
                value={query}
                maxLength={200}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="block text-sm" htmlFor="recovery-type">
              Jenis permintaan
              <select
                id="recovery-type"
                className={controlClass}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua jenis</option>
                <option value="password">Password</option>
                <option value="session">Sesi</option>
              </select>
            </label>
          </div>
          {!requests.length ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              Tidak ada permintaan aktif. Muat ulang untuk memeriksa permintaan
              baru.
            </p>
          ) : !filtered.length ? (
            <p role="status">Tidak ada permintaan yang sesuai pencarian.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {visible.map((r) => (
                  <li
                    key={r.id}
                    className="min-w-0 space-y-2 rounded-lg border p-4 text-sm"
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold">
                          {r.full_name}
                        </p>
                        <p className="break-all text-muted-foreground">
                          @{r.username}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1">
                        {typeName[r.request_type]}
                      </span>
                    </div>
                    <p>
                      {expired(r)
                        ? "Kedaluwarsa"
                        : r.status === "verified"
                          ? "Finalisasi tertunda"
                          : "Menunggu pemeriksaan"}{" "}
                      · Jawaban keamanan{" "}
                      {r.security_answer_verified
                        ? "sesuai"
                        : "belum dibuktikan"}
                    </p>
                    <p className="text-muted-foreground">
                      Diajukan {date.format(new Date(r.requested_at))} WIB
                      <br />
                      Berlaku hingga {date.format(new Date(r.expires_at))} WIB
                    </p>
                    {r.self_request ? (
                      <p>Akun Anda sendiri — perlu Admin lain.</p>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={disabled || expired(r)}
                        aria-pressed={selected === r.id}
                        onClick={() => {
                          chooseRequest(r.id);
                          selectRef.current?.focus();
                        }}
                      >
                        Tinjau permintaan @{r.username}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <nav
                aria-label="Halaman antrean pemulihan"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p className="text-sm text-muted-foreground">
                  {filtered.length} hasil · Halaman {visiblePage} dari {pages}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={visiblePage <= 1}
                    onClick={() => setPage(visiblePage - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    disabled={visiblePage >= pages}
                    onClick={() => setPage(visiblePage + 1)}
                  >
                    Berikutnya
                  </Button>
                </div>
              </nav>
            </>
          )}
        </CardContent>
      </Card>
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Verifikasi dan tindak lanjut</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              ref={formRef}
              className="space-y-4"
              onSubmit={(e) => void submit(e)}
              aria-busy={busy}
            >
              <label className="block text-sm" htmlFor="recovery-request">
                Permintaan
                <select
                  ref={selectRef}
                  id="recovery-request"
                  name="requestId"
                  className={controlClass}
                  required
                  disabled={disabled}
                  value={selected}
                  onChange={(e) => chooseRequest(e.target.value)}
                >
                  <option value="" disabled>
                    Pilih permintaan
                  </option>
                  {requests.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                      disabled={r.self_request || expired(r)}
                    >
                      {r.username} · {typeName[r.request_type]}
                      {r.self_request ? " · Akun sendiri" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {current && (
                <div className="break-words rounded-lg bg-muted p-4 text-sm">
                  <strong>{current.full_name}</strong> (@{current.username})
                  <p>
                    {current.request_type === "password"
                      ? "Persetujuan mencabut semua sesi aplikasi dan membuat password sementara yang wajib diganti."
                      : "Persetujuan mencabut semua sesi aplikasi tanpa mengganti password."}
                  </p>
                  {current.status === "verified" && (
                    <p>
                      Finalisasi tertunda: bila proses sebelumnya terputus,
                      tunggu dua menit sebelum memproses kembali.
                    </p>
                  )}
                  {expired(current) && (
                    <p role="alert">
                      Permintaan telah kedaluwarsa. Muat ulang antrean.
                    </p>
                  )}
                </div>
              )}
              <label className="block text-sm" htmlFor="recovery-evidence">
                Referensi pemeriksaan identitas
                <input
                  id="recovery-evidence"
                  name="evidenceReference"
                  className={controlClass}
                  minLength={8}
                  maxLength={120}
                  required
                  autoComplete="off"
                  disabled={disabled}
                  aria-describedby="recovery-evidence-help"
                />
                <span
                  id="recovery-evidence-help"
                  className="mt-1 block text-sm text-muted-foreground"
                >
                  Nomor berita acara/referensi internal, 8–120 karakter. Gunakan
                  huruf, angka, spasi, titik, garis miring, minus atau garis
                  bawah. Jangan isi NIK, jawaban keamanan atau data rahasia.
                </span>
              </label>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input
                  className="mt-1 size-5 shrink-0"
                  type="checkbox"
                  name="identityConfirmed"
                  required
                  disabled={disabled}
                />
                Saya sudah memverifikasi identitas pemilik akun melalui prosedur
                madrasah.
              </label>
              <label className="block text-sm" htmlFor="recovery-current">
                Password Admin saat ini
                <input
                  id="recovery-current"
                  name="currentPassword"
                  className={controlClass}
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={1024}
                  disabled={disabled}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  name="action"
                  value="approve"
                  disabled={
                    disabled ||
                    !current ||
                    Boolean(current && expired(current)) ||
                    current?.self_request
                  }
                >
                  Setujui dan pulihkan
                </Button>
                <Button
                  type="submit"
                  name="action"
                  value="reject"
                  variant="outline"
                  disabled={
                    disabled ||
                    !current ||
                    Boolean(current && expired(current)) ||
                    current?.self_request
                  }
                >
                  Tolak permintaan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
